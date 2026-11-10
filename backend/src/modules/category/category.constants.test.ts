import {
  DEFAULT_CATEGORIES,
  getDefaultCategoryData,
} from "./category.constants";

describe("默认分类目录", () => {
  it("给定新账本，当生成默认分类，则包含 16 个一级和 49 个二级分类", () => {
    const categories = getDefaultCategoryData("ledger-1");
    const roots = categories.filter((category) => category.parentId === null);
    const children = categories.filter(
      (category) => category.parentId !== null,
    );

    expect(DEFAULT_CATEGORIES).toHaveLength(16);
    expect(roots).toHaveLength(16);
    expect(children).toHaveLength(49);
    expect(categories).toHaveLength(65);
    expect(
      categories.every((category) => category.ledgerId === "ledger-1"),
    ).toBe(true);
    expect(categories.every((category) => category.isSystem)).toBe(true);
    expect(categories.every((category) => category.defaultKey.length > 0)).toBe(
      true,
    );
    expect(
      categories.every((category) => category.iconSource === "LIBRARY"),
    ).toBe(true);
    expect(
      categories.every((category) => category.iconKey.startsWith("tabler:")),
    ).toBe(true);
    expect(
      categories.every((category) => /^#[0-9A-F]{6}$/.test(category.color)),
    ).toBe(true);
  });

  it("给定默认分类目录，当检查父子关系，则每个二级分类都引用同账本一级分类", () => {
    const categories = getDefaultCategoryData("ledger-1");
    const ids = new Set(
      categories
        .filter((category) => category.parentId === null)
        .map((category) => category.id),
    );

    expect(
      categories
        .filter((category) => category.parentId !== null)
        .every((category) => ids.has(category.parentId ?? "")),
    ).toBe(true);
  });
});
