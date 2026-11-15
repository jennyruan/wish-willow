/** POST a local file URI to a Convex upload URL and return its storage id. */
export async function uploadToConvex(uri: string, uploadUrl: string, fallbackType: string) {
  const blob = await (await fetch(uri)).blob();
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": blob.type || fallbackType },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: string };
  return storageId;
}
