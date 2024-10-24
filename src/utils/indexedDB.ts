export function onupgradeneeded(e: IDBVersionChangeEvent) {
  const db = (e.target as IDBRequest).result as IDBDatabase;

  const objectStore = db.createObjectStore("pdf_buffer", {
    keyPath: "id",
    autoIncrement: true,
  });

  objectStore.createIndex("name", "name", { unique: false });
  objectStore.createIndex("url", "url", { unique: true });
  objectStore.createIndex("size", "size", { unique: false });
}
