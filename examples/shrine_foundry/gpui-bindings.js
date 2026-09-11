import { div } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { Button } from "gpui-component";

// Only this module knows how a fixture recipe becomes a GPUI element.
// Resolved context is an explicit argument, never a mutable global Theme.
// Native editor state remains retained by the workbench per appearance.
export function gpuiBindings(cx) {
  const theme = cx.theme();
  const colors = theme.colors;
  const children = (element, content) => content.reduce((parent, child) => parent.child(child), element);
  return {
    page: (_props, content) => children(v_flex().size_full().p_6().gap_4()
      .bg(colors.background).text_color(colors.foreground).text_sm()
      .id("foundry-workbench").overflow_y_scroll(), content),
    row: (_props, content, context) => children(h_flex().w_full().items_start()
      .gap(context.density === "compact" ? theme.spacing.sm : theme.spacing.md).flex_wrap(), content),
    stack: (_props, content) => children(v_flex().gap_1(), content),
    embedding: (props, content) => children(v_flex().id(props.id).flex_1().min_w("20rem").gap_3(), content),
    document: (props, content, context) => {
      let panel = v_flex().id(props.id).w_full().rounded(theme.radius.md)
        .border_1().border_color(colors.border).bg(colors[context.surface])
        .text_color(context.surface === "surface" ? colors.surface_foreground : colors.foreground);
      panel = context.density === "compact" ? panel.p_3().gap_2() : panel.p_4().gap_3();
      return children(panel, content);
    },
    record: (_props, content) => children(v_flex().p_3().gap_1().rounded(theme.radius.md)
      .border_1().border_color(colors.border), content),
    text: ({ value, tone }) => {
      let element = div().child(String(value));
      if (tone === "heading") element = element.text_xl().font_semibold();
      if (tone === "title") element = element.text_base().font_semibold();
      if (tone === "muted") element = element.text_xs().text_color(colors.muted_foreground);
      return element;
    },
    button: ({ id, label, primary, run }, _content, context) => {
      let button = new Button(id).label(label).size(context.density === "compact" ? "small" : "medium")
        .on_click((_event, eventCx) => run(eventCx));
      if (primary) button = button.primary();
      return button;
    },
    input: ({ state }, _content, context) => {
      let input = Input.new(state).rounded(theme.radius.md).border_1()
        .border_color(colors.input).bg(colors.background).text_color(colors.foreground).text_sm();
      input = context.density === "compact" ? input.h_8().px_2() : input.h_9().px_3();
      return input;
    },
  };
}
