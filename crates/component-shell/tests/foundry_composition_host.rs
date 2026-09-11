//! Exercises the Foundry example through the public shell host and native UI.

use gpui::{Entity, TestAppContext, VisualTestContext};
use gpui_base::test_support;
use std::{
    fs,
    ops::Deref,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};

static NEXT_APP: AtomicU64 = AtomicU64::new(0);

/// Loading an application generates declarations beside its entry. Copy the
/// example's actual sources so running the test never edits the checkout.
struct TempApp(PathBuf);

impl TempApp {
    fn from_example() -> Self {
        let source = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../examples/shrine_foundry");
        let path = std::env::temp_dir().join(format!(
            "foundry-composition-{}-{}",
            std::process::id(),
            NEXT_APP.fetch_add(1, Ordering::Relaxed),
        ));
        fs::create_dir_all(&path).expect("create temporary Foundry application");
        for entry in fs::read_dir(source).expect("read Foundry example") {
            let entry = entry.expect("read Foundry source entry");
            if entry
                .path()
                .extension()
                .is_some_and(|extension| extension == "js")
            {
                fs::copy(entry.path(), path.join(entry.file_name())).expect("copy Foundry source");
            }
        }
        Self(path)
    }
}

impl Drop for TempApp {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).expect("remove temporary Foundry application");
    }
}

fn mount(cx: &mut TestAppContext) -> (VisualTestContext, Entity<gpui_shell::ScriptView>, TempApp) {
    cx.update(gpui_component_shell::init);
    let app = TempApp::from_example();
    let runtime = gpui_component_shell::new_isolated_runtime().expect("create component runtime");
    let loaded = runtime
        .load_application(&app.0, "main.js")
        .expect("load Foundry example");
    let mounted = std::rc::Rc::new(std::cell::RefCell::new(None));
    let slot = mounted.clone();
    let window = cx.add_window(move |window, cx| {
        let view = runtime
            .mount_application(&loaded, window, cx)
            .expect("mount Foundry workbench");
        *slot.borrow_mut() = Some(view.clone());
        gpui_component::Root::new(view, window, cx)
    });
    let context = VisualTestContext::from_window(*window.deref(), cx);
    context.simulate_resize(gpui::size(gpui::px(1200.), gpui::px(900.)));
    let view = mounted.borrow().clone().expect("mounted script view");
    (context, view, app)
}

fn draw(context: &mut VisualTestContext) {
    context.run_until_parked();
    context.update(|window, cx| {
        window.refresh();
        window.draw(cx).clear(cx);
    });
}

fn click_button(context: &mut VisualTestContext, id: &'static str, label: &str) {
    draw(context);
    let position = context.update(|window, _| {
        let button = test_support::find(window, &[], &id.into()).unwrap_or_else(|| {
            panic!(
                "missing button {id}: {}",
                test_support::registered_paths(window)
            )
        });
        assert_eq!(button.role(), Some(gpui::Role::Button));
        assert_eq!(button.label(), Some(label));
        assert!(button.visible(), "button {id} must be visible");
        button.bounds().center()
    });
    context.simulate_mouse_move(position, None, Default::default());
    context.simulate_click(position, Default::default());
}

fn snapshot(context: &mut VisualTestContext, view: &Entity<gpui_shell::ScriptView>) -> String {
    context.update(|_, cx| {
        let view = view.read(cx);
        assert_eq!(view.build_error(), None, "Foundry render must succeed");
        view.snapshot()
            .expect("Foundry render snapshot")
            .debug_tree()
    })
}

fn native_inputs(
    context: &mut VisualTestContext,
    appearance: &'static str,
) -> Vec<test_support::ElementSnapshot> {
    draw(context);
    context.update(|window, _| {
        let scope = test_support::scope(window, &[], &appearance.into());
        test_support::snapshots(window)
            .into_iter()
            .filter(|element| {
                element.path().starts_with(&scope) && element.role() == Some(gpui::Role::TextInput)
            })
            .collect()
    })
}

fn click_input(
    context: &mut VisualTestContext,
    appearance: &'static str,
) -> test_support::ElementSnapshot {
    let inputs = native_inputs(context, appearance);
    assert_eq!(
        inputs.len(),
        1,
        "one native input in {appearance}: {inputs:?}"
    );
    let input = inputs[0].clone();
    assert!(input.visible(), "input in {appearance} must be visible");
    let position = input.bounds().center();
    context.simulate_mouse_move(position, None, Default::default());
    context.simulate_click(position, Default::default());
    draw(context);
    input
}

fn select_input_text(context: &mut VisualTestContext) {
    #[cfg(target_os = "macos")]
    context.simulate_keystrokes("cmd-a");
    #[cfg(not(target_os = "macos"))]
    context.simulate_keystrokes("ctrl-a");
}

fn replace_input(context: &mut VisualTestContext, appearance: &'static str, text: &str) {
    click_input(context, appearance);
    select_input_text(context);
    // Follow Kit's native input helper: key_char reaches GPUI's text input
    // handler, including spaces, rather than treating a whole word as a chord.
    for character in text.chars() {
        let text = character.to_string();
        let mut key = gpui::Keystroke::parse(&text).expect("a character is a valid keystroke");
        key.key_char = Some(text);
        context.update(|window, cx| window.dispatch_keystroke(key, cx));
        draw(context);
    }
}

fn copied_input(context: &mut VisualTestContext, appearance: &'static str) -> String {
    click_input(context, appearance);
    select_input_text(context);
    // The shell's Input frame exposes its native role and bounds, but not an
    // accessibility value. Observe the editor through its real Copy command.
    context.update(|_, cx| {
        cx.write_to_clipboard(gpui::ClipboardItem::new_string("copy did not run".into()));
    });
    #[cfg(target_os = "macos")]
    context.simulate_keystrokes("cmd-c");
    #[cfg(not(target_os = "macos"))]
    context.simulate_keystrokes("ctrl-c");
    context.run_until_parked();
    context.update(|_, cx| {
        cx.read_from_clipboard()
            .and_then(|item| item.text())
            .expect("native Copy must produce text")
    })
}

fn description_subtree(tree: &str, id: &str) -> String {
    let marker = format!(":id[Str({id:?})]");
    let lines: Vec<_> = tree.lines().collect();
    let start = lines
        .iter()
        .position(|line| line.contains(&marker))
        .unwrap_or_else(|| panic!("missing described element {id}: {tree}"));
    let depth = lines[start].len() - lines[start].trim_start().len();
    std::iter::once(lines[start])
        .chain(
            lines[start + 1..]
                .iter()
                .copied()
                .take_while(|line| line.len() - line.trim_start().len() > depth),
        )
        .collect::<Vec<_>>()
        .join("\n")
}

fn document_background(
    context: &mut VisualTestContext,
    appearance: &'static str,
    commit: &'static str,
) -> gpui::Background {
    let inputs = native_inputs(context, appearance);
    assert_eq!(inputs.len(), 1, "one native editor in {appearance}");
    context.update(|window, _| {
        let button = test_support::find(window, &[], &commit.into()).expect("native Commit button");
        let input = inputs[0].bounds().center().scale(window.scale_factor());
        let button = button.bounds().center().scale(window.scale_factor());
        // Read the actual painted surface shared by these two native controls.
        // Their measured geometry identifies the surface; no screen coordinates
        // or expected pixel dimensions are part of the contract.
        window
            .painted_quads()
            .into_iter()
            .filter(|quad| {
                !quad.background.is_transparent()
                    && quad.bounds.contains(&input)
                    && quad.bounds.contains(&button)
                    && quad.content_mask.bounds.contains(&input)
                    && quad.content_mask.bounds.contains(&button)
            })
            .min_by(|left, right| {
                let area = |quad: &gpui::Quad| quad.bounds.size.width.0 * quad.bounds.size.height.0;
                area(left).total_cmp(&area(right))
            })
            .unwrap_or_else(|| panic!("missing painted document surface in {appearance}"))
            .background
    })
}

#[gpui::test]
fn local_recipe_override_preserves_the_other_context_theme_and_native_editors(
    cx: &mut TestAppContext,
) {
    const A: &str = "appearance-editor-a";
    const B: &str = "appearance-editor-b";
    const DRAFT: &str = "One draft across two contexts";

    let (mut context, view, _app) = mount(cx);
    draw(&mut context);
    let (base_theme, component_theme) = context.update(|_, cx| {
        (
            gpui_base::Theme::global(cx),
            serde_json::to_value(gpui_component::Theme::global(cx))
                .expect("serialize global theme"),
        )
    });
    replace_input(&mut context, A, DRAFT);
    let input_paths = [A, B].map(|appearance| {
        assert_eq!(copied_input(&mut context, appearance), DRAFT);
        native_inputs(&mut context, appearance)[0].path().to_vec()
    });
    let before = snapshot(&mut context, &view);
    let desk = description_subtree(&before, "context:desk");
    let writing = description_subtree(&before, A);
    let reference = description_subtree(&before, B);
    assert!(
        writing.lines().next().unwrap().contains(" .p_4 .gap_3"),
        "{writing}"
    );
    assert!(
        reference.lines().next().unwrap().contains(" .p_3 .gap_2"),
        "{reference}"
    );
    assert!(
        writing
            .lines()
            .any(|line| line.contains("Input #") && line.contains(" .h_9")),
        "{writing}"
    );
    assert!(
        reference
            .lines()
            .any(|line| line.contains("Input #") && line.contains(" .h_8")),
        "{reference}"
    );
    assert!(writing.contains("Flow: flow-working"), "{writing}");
    assert!(
        !reference.contains("Flow: flow-working"),
        "the compact recipe must omit the identity slot: {reference}"
    );
    for (document, heading, footer, absent_footer) in [
        (
            &writing,
            "Working document",
            "Keep writing here.",
            "This reference stays connected to the working draft.",
        ),
        (
            &reference,
            "Document reference",
            "This reference stays connected to the working draft.",
            "Keep writing here.",
        ),
    ] {
        assert!(
            document.contains(heading) && document.contains(footer),
            "{document}"
        );
        assert!(
            !document.contains(absent_footer),
            "caller slots crossed contexts: {document}"
        );
    }

    // cx.theme() exposes colors as six-digit sRGB strings, so compare the
    // native paint with that public bridge's channel precision.
    let shell_background = |color: gpui::Hsla| -> gpui::Background {
        let color = gpui::Rgba::from(color);
        let channel = |value: f32| (value.clamp(0., 1.) * 255.).round() as u32;
        gpui::rgb((channel(color.r) << 16) | (channel(color.g) << 8) | channel(color.b)).into()
    };
    let desk_background = shell_background(base_theme.tokens.colors.surface);
    let reference_background = shell_background(base_theme.tokens.colors.muted);
    assert_ne!(
        desk_background, reference_background,
        "fixture contexts need distinct semantic surfaces"
    );
    assert_eq!(
        document_background(&mut context, A, "appearance-editor-a:commit"),
        desk_background
    );
    assert_eq!(
        document_background(&mut context, B, "appearance-editor-b:commit"),
        reference_background
    );

    click_button(&mut context, "context:reference:toggle", "Expand reference");
    draw(&mut context);
    let expanded = snapshot(&mut context, &view);
    assert_eq!(
        description_subtree(&expanded, "context:desk"),
        desk,
        "a local recipe change must leave the desk's whole description untouched"
    );
    let expanded_reference = description_subtree(&expanded, B);
    assert!(
        expanded_reference
            .lines()
            .next()
            .unwrap()
            .contains(" .p_4 .gap_3"),
        "{expanded_reference}"
    );
    assert!(
        expanded_reference
            .lines()
            .any(|line| line.contains("Input #") && line.contains(" .h_9")),
        "{expanded_reference}"
    );
    assert!(
        expanded_reference.contains("Document reference")
            && expanded_reference.contains("This reference stays connected to the working draft."),
        "caller slots must survive recipe changes: {expanded_reference}"
    );
    assert!(
        expanded_reference.contains("Flow: flow-working"),
        "the expanded recipe must restore the identity slot: {expanded_reference}"
    );
    assert!(
        expanded.contains("source-document-42 · revision 1"),
        "{expanded}"
    );
    assert!(expanded.contains("A continuous body of work"), "{expanded}");
    for (index, appearance) in [A, B].into_iter().enumerate() {
        assert_eq!(
            native_inputs(&mut context, appearance)[0].path(),
            input_paths[index],
            "local recipe changes must retain the native editor in {appearance}"
        );
        assert_eq!(copied_input(&mut context, appearance), DRAFT);
    }
    assert_eq!(
        document_background(&mut context, A, "appearance-editor-a:commit"),
        desk_background
    );
    assert_eq!(
        document_background(&mut context, B, "appearance-editor-b:commit"),
        reference_background
    );
    let assert_global_theme = |context: &mut VisualTestContext| {
        context.update(|_, cx| {
            let current = gpui_base::Theme::global(cx);
            assert_eq!(current.appearance, base_theme.appearance);
            assert_eq!(
                current.tokens, base_theme.tokens,
                "local presentation must not mutate Base's global tokens"
            );
            assert_eq!(
                serde_json::to_value(gpui_component::Theme::global(cx)).unwrap(),
                component_theme,
                "local presentation must not mutate Component's global theme"
            );
        });
    };
    assert_global_theme(&mut context);

    click_button(
        &mut context,
        "context:reference:toggle",
        "Compact reference",
    );
    draw(&mut context);
    let restored = snapshot(&mut context, &view);
    assert_eq!(description_subtree(&restored, "context:desk"), desk);
    assert_eq!(
        description_subtree(&restored, B),
        reference,
        "the reference must restore its compact recipe, local density, and caller slots"
    );
    for (index, appearance) in [A, B].into_iter().enumerate() {
        assert_eq!(
            native_inputs(&mut context, appearance)[0].path(),
            input_paths[index]
        );
        assert_eq!(copied_input(&mut context, appearance), DRAFT);
    }
    assert_eq!(
        document_background(&mut context, A, "appearance-editor-a:commit"),
        desk_background
    );
    assert_eq!(
        document_background(&mut context, B, "appearance-editor-b:commit"),
        reference_background
    );
    assert_global_theme(&mut context);
}

#[gpui::test]
fn native_actions_preserve_the_shared_draft_when_the_source_changes(cx: &mut TestAppContext) {
    let (mut context, view, _app) = mount(cx);
    draw(&mut context);
    let tree = snapshot(&mut context, &view);
    for expected in ["appearance-editor-a", "appearance-editor-b", "flow-working"] {
        assert!(tree.contains(expected), "missing {expected}: {tree}");
    }

    click_button(
        &mut context,
        "fixture:external-update",
        "Simulate external edit",
    );
    draw(&mut context);
    let changed = snapshot(&mut context, &view);
    for expected in [
        "Outcome: ok / external-update",
        "Updated elsewhere",
        "source-document-42 · revision 2",
    ] {
        assert!(changed.contains(expected), "missing {expected}: {changed}");
    }
    assert_eq!(
        changed.matches("Base revision 1").count(),
        2,
        "both appearances must retain the same original draft base: {changed}",
    );

    click_button(&mut context, "appearance-editor-a:commit", "Commit");
    draw(&mut context);
    let refused = snapshot(&mut context, &view);
    for expected in [
        "Outcome: conflict / revision-conflict",
        "The source changed. Your draft is still available.",
        "Updated elsewhere",
        "source-document-42 · revision 2",
    ] {
        assert!(refused.contains(expected), "missing {expected}: {refused}");
    }
    assert_eq!(
        refused.matches("Base revision 1").count(),
        2,
        "a refused native commit must not replace or rebase the shared draft: {refused}",
    );
}

#[gpui::test]
fn native_editing_survives_move_and_remount_without_widening_commit_authority(
    cx: &mut TestAppContext,
) {
    const A: &str = "appearance-editor-a";
    const B: &str = "appearance-editor-b";
    const DRAFT: &str = "A shared native draft";
    const RESUMED: &str = "Resumed native draft";

    let (mut context, view, _app) = mount(cx);
    replace_input(&mut context, A, DRAFT);
    for appearance in [A, B] {
        assert_eq!(
            copied_input(&mut context, appearance),
            DRAFT,
            "native typing in A must update the editor in {appearance}",
        );
    }
    let edited = snapshot(&mut context, &view);
    assert!(edited.contains("A continuous body of work"), "{edited}");
    assert!(
        edited.contains("source-document-42 · revision 1"),
        "{edited}"
    );
    assert_eq!(edited.matches("uncommitted draft").count(), 2, "{edited}");

    let original_input_id = native_inputs(&mut context, A)[0]
        .path()
        .last()
        .expect("native input has an observed identity")
        .clone();
    click_button(&mut context, "appearance-editor-a:move", "Move");
    draw(&mut context);
    let moved = snapshot(&mut context, &view);
    assert!(moved.contains("Appearance A · embedded"), "{moved}");
    assert!(moved.contains("Appearance B · main"), "{moved}");
    assert_eq!(
        native_inputs(&mut context, A)[0].path().last(),
        Some(&original_input_id),
        "moving the appearance must retain its native editor",
    );
    assert_eq!(copied_input(&mut context, A), DRAFT);

    click_button(&mut context, "appearance-editor-a:unmount", "Close");
    assert!(native_inputs(&mut context, A).is_empty());
    assert_eq!(copied_input(&mut context, B), DRAFT);
    click_button(
        &mut context,
        "appearance-editor-a:mount",
        "Reopen appearance",
    );
    assert_ne!(
        native_inputs(&mut context, A)[0].path().last(),
        Some(&original_input_id),
        "reopening must create a new editor after releasing the closed one",
    );
    assert_eq!(copied_input(&mut context, A), DRAFT);
    // A fresh edit also verifies that the remounted editor's event subscription
    // still reaches the shared Flow; showing its initial value is insufficient.
    replace_input(&mut context, A, RESUMED);
    assert_eq!(copied_input(&mut context, B), RESUMED);

    click_button(
        &mut context,
        "fixture:toggle-authority",
        "Restrict appearance B",
    );
    assert!(native_inputs(&mut context, B).is_empty());
    click_button(&mut context, "appearance-editor-b:commit", "Commit");
    draw(&mut context);
    let refused = snapshot(&mut context, &view);
    for expected in [
        "Outcome: refused / outside-envelope",
        "This appearance does not admit that action.",
        "Read only: Resumed native draft",
        "A continuous body of work",
        "source-document-42 · revision 1",
    ] {
        assert!(refused.contains(expected), "missing {expected}: {refused}");
    }
    assert_eq!(refused.matches("Base revision 1").count(), 2, "{refused}");
    assert_eq!(copied_input(&mut context, A), RESUMED);
}
