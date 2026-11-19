import type { NotificationVariable } from '#/api/model/notification';

/** Inspect fields in Go template actions, including conditionals and pipelines. */
export function referencedVariables(text: string): string[] {
  const names = new Set<string>();
  for (const action of text.matchAll(/{{([\s\S]*?)}}/g)) {
    const expression = (action[1] ?? '')
      .replaceAll(/\/\*[\s\S]*?\*\//g, '')
      .replaceAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`/g, '');
    for (const field of expression.matchAll(/(?:^|[^\w.])\.([A-Z_a-z]\w*)/g)) {
      if (field[1]) names.add(field[1]);
    }
  }
  return [...names];
}

export function unknownVariables(
  text: string,
  variables: NotificationVariable[],
) {
  const declared = new Set(variables.map((item) => item.name));
  return referencedVariables(text).filter((name) => !declared.has(name));
}

export function insertVariable(
  text: string,
  name: string,
  start: number,
  end: number,
) {
  const value = `{{.${name}}}`;
  return {
    text: text.slice(0, start) + value + text.slice(end),
    caret: start + value.length,
  };
}
