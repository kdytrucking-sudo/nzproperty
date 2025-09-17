// src/lib/storage.ts
import { storage } from './firebase'; // 已初始化的 Firebase App Storage
import { ref, uploadBytes, getBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";

/**
 * 写入文本或 JSON 文件
 * @param path Firebase Storage 路径
 * @param content 文本内容
 * @param type MIME 类型，默认 text/plain
 */
export async function writeFile(path: string, content: string, type: string = "text/plain"): Promise<void> {
  const storageRef = ref(storage, path);
  const blob = new Blob([content], { type });
  await uploadBytes(storageRef, blob);
}

/**
 * 读取文本文件
 * @param path Firebase Storage 路径
 * @returns 文本内容
 */
export async function readFile(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  const bytes = await getBytes(storageRef);
  return new TextDecoder().decode(bytes);
}

/**
 * 写入 JSON 文件
 * @param path Firebase Storage 路径
 * @param obj 任意对象
 */
export async function writeJSON(path: string, obj: any): Promise<void> {
  await writeFile(path, JSON.stringify(obj, null, 2), "application/json");
}

/**
 * 读取 JSON 文件
 * @param path Firebase Storage 路径
 * @returns JSON 对象
 */
export async function readJSON(path: string): Promise<any> {
  const text = await readFile(path);
  return JSON.parse(text);
}

/**
 * 上传二进制文件（图片、Word、PDF 等）
 * @param path Firebase Storage 路径
 * @param data Blob 或 ArrayBuffer
 * @param type MIME 类型，默认 application/octet-stream
 */
export async function uploadBinary(path: string, data: Blob | ArrayBuffer, type: string = "application/octet-stream"): Promise<void> {
  const storageRef = ref(storage, path);
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  await uploadBytes(storageRef, blob);
}

/**
 * 下载二进制文件
 * @param path Firebase Storage 路径
 * @returns ArrayBuffer
 */
export async function downloadBinary(path: string): Promise<ArrayBuffer> {
  const storageRef = ref(storage, path);
  return await getBytes(storageRef);
}

/**
 * 获取文件下载 URL（可以在前端直接访问）
 * @param path Firebase Storage 路径
 * @returns 文件 URL
 */
export async function getFileURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return await getDownloadURL(storageRef);
}

/**
 * 列出指定路径下的所有文件名
 * @param path Firebase Storage 目录路径
 * @returns 文件名数组
 */
export async function listFileNames(path: string): Promise<string[]> {
    const storageRef = ref(storage, path);
    const res = await listAll(storageRef);
    return res.items.map((itemRef) => itemRef.name);
}

/**
 * 删除指定路径的文件
 * @param path Firebase Storage 文件路径
 */
export async function deleteFile(path: string): Promise<void> {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
}
