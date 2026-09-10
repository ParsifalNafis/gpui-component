import { div } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { Button } from "gpui-component";

// Only this module knows how a fixture recipe becomes a GPUI element.
// Native controls are rebuilt per snapshot; their editor state is retained by
// the workbench per appearance. Styles consume the host's semantic colors.
export function gpuiBindings(cx) {
  const colors = cx.theme().colors;
  const children = (element, content) => content.reduce((parent, child) => parent.child(child), element);
  return {
    page: (_props, content) => children(v_flex().size_full().p_6().gap_4()
      .bg(colors.background).text_color(colors.foreground).text_sm()
      .id("foundry-workbench").overflow_y_scroll(), content),
    row: (_props, content) => children(h_flex().w_full().items_start().gap_3().flex_wrap(), content),
    stack: (_props, content) => children(v_flex().gap_1(), content),
    panel: (props, content) => children(v_flex().id(props.id).flex_1().min_w("20rem")
      .p_4().gap_3().rounded_lg().border_1().border_color(colors.border)
      .bg(colors.surface), content),
    record: (_props, content) => children(v_flex().p_3().gap_1().rounded_md()
      .border_1().border_color(colors.border), content),
    text: ({ value, tone }) => {
      let element = div().child(String(value));
      if (tone === "heading") element = element.text_xl().font_semibold();
      if (tone === "title") element = element.text_base().font_semibold();
      if (tone === "muted") element = element.text_xs().text_color(colors.muted_foreground);
      return element;
    },
    button: ({ id, label, primary, run }) => {
      let button = new Button(id).label(label).size("small").on_click((_event, eventCx) => run(eventCx));
      if (primary) button = button.primary();
      return button;
    },
    input: ({ state }) => Input.new(state).h_9().px_3().rounded_md().border_1()
      .border_color(colors.input).bg(colors.background).text_sm(),
  };
}
