//! Exercises the Foundry example through the public shell host and native UI.

use gpui::{AppContext as _, Entity, TestAppContext, VisualTestContext};
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

struct Empty;

impl gpui::Render for Empty {
    fn render(
        &mut self,
        _: &mut gpui::Window,
        _: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        gpui::div()
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
    let mut context = VisualTestContext::from_window(*window.deref(), cx);
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

#[gpui::test]
fn foundry_example_loads_and_materializes_native_components(cx: &mut TestAppContext) {
    cx.update(gpui_component_shell::init);
    let app = TempApp::from_example();
    let runtime = gpui_component_shell::new_isolated_runtime().expect("create component runtime");
    let window = cx.add_window(|window, cx| {
        let empty = cx.new(|_| Empty);
        gpui_component::Root::new(empty, window, cx)
    });
    let mut context = VisualTestContext::from_window(*window.deref(), cx);
    let tree = context
        .update(|window, cx| runtime.check(&app.0, window, cx))
        .expect("Foundry script and eager native components must materialize");
    for expected in ["Button", "source-document-42", "flow-working"] {
        assert!(tree.contains(expected), "missing {expected}: {tree}");
    }
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
