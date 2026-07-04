import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { yuntiMemoryDir, yuntiMemoryFile } from "../lib/runtime-paths.js"
import { clampNumber, redactLikelySensitiveText, truncateText } from "./redaction.js"

const MAX_MEMORY_ITEMS = 500
const DEFAULT_ROUTE_USER_ID = process.env.YUNTI_BROWSER_USER_ID || "local"

function normalizeMemoryUserId(value) {
  const userId = String(value || "").trim()
  return userId && userId !== "anonymous" ? userId : ""
}

export function requireMemoryUserId(value = "") {
  const userId = normalizeMemoryUserId(value) || normalizeMemoryUserId(DEFAULT_ROUTE_USER_ID)
  if (!userId) {
    throw new Error("userId is required for Yunti learning memory")
  }
  return userId
}

export function memoryFile(userId) {
  return yuntiMemoryFile(requireMemoryUserId(userId))
}

function memoryDir(userId) {
  return yuntiMemoryDir(requireMemoryUserId(userId))
}

async function readMemoryStore(userId) {
  try {
    const data = JSON.parse(await readFile(memoryFile(userId), "utf8"))
    return { version: 1, memories: Array.isArray(data.memories) ? data.memories : [] }
  } catch {
    return { version: 1, memories: [] }
  }
}

async function writeMemoryStore(store, userId) {
  await mkdir(memoryDir(userId), { recursive: true })
  const memories = store.memories.slice(-MAX_MEMORY_ITEMS)
  await writeFile(memoryFile(userId), `${JSON.stringify({ version: 1, memories }, null, 2)}\n`)
  return { version: 1, memories }
}

function sanitizeMemoryInput(args = {}) {
  return {
    id: randomUUID(),
    kind: truncateText(args.kind || "other", 80),
    title: redactLikelySensitiveText(args.title, 300),
    detail: redactLikelySensitiveText(args.detail, 4000),
    tags: Array.isArray(args.tags)
      ? args.tags.map((x) => redactLikelySensitiveText(x, 80)).filter(Boolean).slice(0, 20)
      : [],
    confidence: clampNumber(args.confidence ?? 0.5, 0, 1, 0.5),
    source: redactLikelySensitiveText(args.source || "", 500),
    relatedNetworkEventIds: Array.isArray(args.relatedNetworkEventIds)
      ? args.relatedNetworkEventIds.map((x) => Number(x)).filter(Number.isFinite).slice(0, 50)
      : [],
    createdAt: new Date().toISOString(),
  }
}

export async function rememberLearning(args = {}) {
  if (!String(args.title || "").trim()) throw new Error("title is required")
  if (!String(args.detail || "").trim()) throw new Error("detail is required")
  const userId = requireMemoryUserId(args.userId)
  const store = await readMemoryStore(userId)
  const memory = sanitizeMemoryInput({ ...args, userId })
  store.memories.push(memory)
  await writeMemoryStore(store, userId)
  return { remembered: true, memory }
}

export async function getLearningMemory(args = {}) {
  const userId = requireMemoryUserId(args.userId)
  const store = await readMemoryStore(userId)
  const query = String(args.query || "").trim().toLowerCase()
  const kind = String(args.kind || "").trim().toLowerCase()
  const tags = Array.isArray(args.tags)
    ? args.tags.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : []
  const limit = clampNumber(args.limit || 50, 1, 100, 50)
  let memories = store.memories
  if (kind) memories = memories.filter((item) => String(item.kind || "").toLowerCase() === kind)
  if (query) {
    memories = memories.filter((item) =>
      [item.title, item.detail, item.source, ...(item.tags || [])].some((value) =>
        String(value || "").toLowerCase().includes(query)
      )
    )
  }
  if (tags.length > 0) {
    memories = memories.filter((item) => {
      const ownTags = new Set((item.tags || []).map((tag) => String(tag).toLowerCase()))
      return tags.every((tag) => ownTags.has(tag))
    })
  }
  memories = memories.slice(-limit).reverse()
  return { memories, total: store.memories.length, returned: memories.length, storagePath: memoryFile(userId) }
}

export async function forgetLearningMemory(args = {}) {
  const userId = requireMemoryUserId(args.userId)
  const store = await readMemoryStore(userId)
  if (args.all) {
    if (!args.confirmed) throw new Error("confirmed=true is required to delete all learning memories")
    const deleted = store.memories.length
    await writeMemoryStore({ version: 1, memories: [] }, userId)
    return { deleted }
  }
  const id = String(args.id || "").trim()
  if (!id) {
    throw new Error("id is required unless all=true and confirmed=true. Call yunti_get_learning_memory first to find the memory id.")
  }
  const before = store.memories.length
  const memories = store.memories.filter((item) => item.id !== id)
  await writeMemoryStore({ version: 1, memories }, userId)
  const deleted = before - memories.length
  return {
    deleted,
    ...(deleted
      ? {}
      : { message: `No learning memory found for id: ${id}. Call yunti_get_learning_memory to list current ids.` }),
  }
}
