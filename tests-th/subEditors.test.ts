import { subEditorKind } from "src/merge-hsm/integration/subEditors";

function dom(matches: string[]): { closest(selector: string): unknown } {
	return { closest: (selector: string) => (matches.includes(selector) ? {} : null) };
}

const detached = dom([]);

test("a footnote-pane embed is a sub-editor", () => {
	expect(subEditorKind({ subpath: "#[^1]" }, detached)).toBe(
		"a subpath-scoped embed editor",
	);
});

test("a heading embed is a sub-editor", () => {
	expect(subEditorKind({ subpath: "#Some heading" }, detached)).toBe(
		"a subpath-scoped embed editor",
	);
});

test("a subpath embed is detected while its DOM is still detached", () => {
	// The embed sets its subpath at construction, before the editor is
	// attached; the table arm cannot answer during that window.
	expect(subEditorKind({ subpath: "#^block-id" }, detached)).not.toBeNull();
});

test("a table-cell editor is a sub-editor", () => {
	expect(subEditorKind({}, dom([".table-cell-wrapper"]))).toBe(
		"an embedded table-cell editor",
	);
});

test("a view's own editor is not a sub-editor", () => {
	expect(subEditorKind({}, detached)).toBeNull();
});

test("a whole-file editable embed is not a sub-editor", () => {
	// Canvas file nodes embed a whole file and must keep binding.
	expect(subEditorKind({ subpath: "" }, detached)).toBeNull();
});

test("a missing info field is not a sub-editor", () => {
	expect(subEditorKind(undefined, detached)).toBeNull();
	expect(subEditorKind(null, detached)).toBeNull();
});
