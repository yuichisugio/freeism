import { MAX_FILE_SIZE } from "@/lib/cloudflare/upload-constants";
import { describe, expect, test, vi } from "vitest";

import { validateImageFiles } from "./image-validator";

// ファイル作成用のヘルパー関数
function createTestFile(
  options: {
    name?: string;
    type?: string;
    size?: number;
    content?: string;
  } = {},
) {
  const file = new File([options.content ?? "test content"], options.name ?? "test.jpg", {
    type: options.type ?? "image/jpeg",
    lastModified: Date.now(),
  });

  // ファイルサイズを設定
  const size = options.size ?? 1024 * 1024; // デフォルト1MB
  Object.defineProperty(file, "size", { value: size });

  return file;
}

describe("validateImageFiles", () => {
  test("should return valid true for valid image files", async () => {
    // 有効な画像ファイルのモック作成
    const validImageFile = createTestFile({
      name: "test.jpg",
      type: "image/jpeg",
      size: 1024 * 1024, // 1MB
    });

    const result = await validateImageFiles([validImageFile]);

    expect(result).toStrictEqual({ valid: true });
  });

  test("should return error for empty file array", async () => {
    const result = await validateImageFiles([]);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルが選択されていません",
    });
  });

  test("should return error for null files", async () => {
    // @ts-expect-error - テスト用にnullを渡す
    const result = await validateImageFiles(null);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルが選択されていません",
    });
  });

  test("should return error for undefined files", async () => {
    // @ts-expect-error - テスト用にundefinedを渡す
    const result = await validateImageFiles(undefined);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルが選択されていません",
    });
  });

  test("should return error for file size exceeding limit", async () => {
    // ファイルサイズが上限を超えるファイルのモック作成
    const oversizedFile = createTestFile({
      name: "large.jpg",
      type: "image/jpeg",
      size: MAX_FILE_SIZE + 1,
    });

    const result = await validateImageFiles([oversizedFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。(large.jpg)",
    });
  });

  test("should return error for first oversized file in multiple files", async () => {
    // 複数ファイルの中で最初のファイルがサイズ超過の場合
    const oversizedFile = createTestFile({
      name: "large1.jpg",
      type: "image/jpeg",
      size: MAX_FILE_SIZE + 1,
    });
    const validFile = createTestFile({
      name: "valid.jpg",
      type: "image/jpeg",
      size: 1024 * 1024,
    });

    const result = await validateImageFiles([oversizedFile, validFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。(large1.jpg)",
    });
  });

  test("should return error for second oversized file in multiple files", async () => {
    // 複数ファイルの中で2番目のファイルがサイズ超過の場合
    const validFile = createTestFile({
      name: "valid.jpg",
      type: "image/jpeg",
      size: 1024 * 1024,
    });
    const oversizedFile = createTestFile({
      name: "large2.jpg",
      type: "image/jpeg",
      size: MAX_FILE_SIZE + 1,
    });

    const result = await validateImageFiles([validFile, oversizedFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "ファイルサイズが大きすぎます。10MB以下のファイルを選択してください。(large2.jpg)",
    });
  });

  test("should return valid true for file size at exact limit", async () => {
    // ファイルサイズが上限ちょうどのファイルのモック作成
    const maxSizeFile = createTestFile({
      name: "max-size.jpg",
      type: "image/jpeg",
      size: MAX_FILE_SIZE,
    });

    const result = await validateImageFiles([maxSizeFile]);

    expect(result).toStrictEqual({ valid: true });
  });

  test("should return valid true for very small file", async () => {
    // 非常に小さなファイルのモック作成
    const smallFile = createTestFile({
      name: "small.jpg",
      type: "image/jpeg",
      size: 1, // 1バイト
    });

    const result = await validateImageFiles([smallFile]);

    expect(result).toStrictEqual({ valid: true });
  });

  test("should return valid true for zero size file", async () => {
    // サイズ0のファイルのテスト
    const zeroSizeFile = createTestFile({
      name: "empty.jpg",
      type: "image/jpeg",
      size: 0,
    });

    const result = await validateImageFiles([zeroSizeFile]);

    expect(result).toStrictEqual({ valid: true });
  });

  test("should return valid true for various image MIME types", async () => {
    // 様々な画像MIMEタイプのテスト
    const imageTypes = [
      { type: "image/jpeg", name: "test.jpg" },
      { type: "image/jpg", name: "test.jpg" },
      { type: "image/png", name: "test.png" },
      { type: "image/gif", name: "test.gif" },
      { type: "image/webp", name: "test.webp" },
      { type: "image/avif", name: "test.avif" },
    ];

    for (const imageType of imageTypes) {
      const imageFile = createTestFile({
        name: imageType.name,
        type: imageType.type,
        size: 1024 * 1024, // 1MB
      });

      const result = await validateImageFiles([imageFile]);

      expect(result).toStrictEqual({ valid: true });
    }
  });

  test("should return valid true for multiple valid image files", async () => {
    // 複数の有効な画像ファイルのテスト
    const files = [
      createTestFile({ name: "image1.jpg", type: "image/jpeg", size: 1024 * 1024 }),
      createTestFile({ name: "image2.png", type: "image/png", size: 2 * 1024 * 1024 }),
      createTestFile({ name: "image3.webp", type: "image/webp", size: 3 * 1024 * 1024 }),
    ];

    const result = await validateImageFiles(files);

    expect(result).toStrictEqual({ valid: true });
  });

  test("should return error for non-image files", async () => {
    // 非画像ファイルのテスト
    const nonImageFile = createTestFile({
      name: "document.pdf",
      type: "application/pdf",
      size: 1024 * 1024, // 1MB
    });

    const result = await validateImageFiles([nonImageFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像ファイルのみアップロード可能です。(document.pdf: application/pdf)",
    });
  });

  test("should return error for first non-image file in multiple files", async () => {
    // 複数ファイルの中で最初のファイルが非画像の場合
    const nonImageFile = createTestFile({
      name: "document.pdf",
      type: "application/pdf",
      size: 1024 * 1024,
    });
    const validFile = createTestFile({
      name: "valid.jpg",
      type: "image/jpeg",
      size: 1024 * 1024,
    });

    const result = await validateImageFiles([nonImageFile, validFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像ファイルのみアップロード可能です。(document.pdf: application/pdf)",
    });
  });

  test("should return error for text files", async () => {
    // テキストファイルのテスト
    const textFile = createTestFile({
      name: "document.txt",
      type: "text/plain",
      size: 1024, // 1KB
    });

    const result = await validateImageFiles([textFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像ファイルのみアップロード可能です。(document.txt: text/plain)",
    });
  });

  test("should return error for files with empty MIME type", async () => {
    // 空のMIMEタイプのファイルのテスト
    const emptyMimeFile = createTestFile({
      name: "unknown",
      type: "",
      size: 1024, // 1KB
    });

    const result = await validateImageFiles([emptyMimeFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像ファイルのみアップロード可能です。(unknown: )",
    });
  });

  test("should handle exceptions and return error", async () => {
    // 例外が発生した場合のテスト
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // モック実装：何もしない
    });

    // ファイルのプロパティアクセス時に例外を発生させる
    const problematicFile = {} as File;
    Object.defineProperty(problematicFile, "size", {
      get() {
        throw new Error("File access error");
      },
    });

    const result = await validateImageFiles([problematicFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像の検証中にエラーが発生しました",
    });
    expect(consoleSpy).toHaveBeenCalledWith("画像バリデーションエラー:", expect.any(Error));

    consoleSpy.mockRestore();
  });

  test("should handle type access error", async () => {
    // ファイルタイプアクセス時のエラーテスト
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // モック実装：何もしない
    });

    const problematicFile = {} as File;
    Object.defineProperty(problematicFile, "size", { value: 1024 });
    Object.defineProperty(problematicFile, "name", { value: "test.jpg" });
    Object.defineProperty(problematicFile, "type", {
      get() {
        throw new Error("Type access error");
      },
    });

    const result = await validateImageFiles([problematicFile]);

    expect(result).toStrictEqual({
      valid: false,
      error: "画像の検証中にエラーが発生しました",
    });
    expect(consoleSpy).toHaveBeenCalledWith("画像バリデーションエラー:", expect.any(Error));

    consoleSpy.mockRestore();
  });

  test("should handle negative file size", async () => {
    // 負のファイルサイズのテスト（境界値テスト）
    const negativeFile = createTestFile({
      name: "negative.jpg",
      type: "image/jpeg",
      size: -1,
    });

    const result = await validateImageFiles([negativeFile]);

    expect(result).toStrictEqual({ valid: true });
  });
});
