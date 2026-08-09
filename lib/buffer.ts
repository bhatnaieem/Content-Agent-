const BUFFER_API = "https://api.buffer.com";

export type BufferChannel = {
  id: string;
  name: string;
  displayName: string | null;
  descriptor: string;
  service: string;
  avatar: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
  externalLink: string | null;
};

export type BufferOrganization = {
  id: string;
  name: string;
  channelCount: number;
  limits: { channels: number; scheduledPosts: number; scheduledThreadsPerChannel?: number };
};

async function bufferGraphQL<T>(query: string) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error("Buffer is not configured. Add BUFFER_API_KEY in Vercel.");
  const response = await fetch(BUFFER_API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ query }), cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(`Buffer API request failed (${response.status}).`);
  if (json.errors?.length) throw new Error(json.errors.map((e: { message?: string }) => e.message || "Buffer API error").join("; "));
  return json.data as T;
}

export async function getBufferWorkspace() {
  const data = await bufferGraphQL<{ account: { id: string; name: string; timezone: string; organizations: BufferOrganization[] } }>(`
    query GetBufferWorkspace { account { id name timezone organizations { id name channelCount limits { channels scheduledPosts scheduledThreadsPerChannel } } } }
  `);
  const organization = (data.account.organizations || [])[0];
  if (!organization) return { account: data.account, organization: null, channels: [], plan: "Not connected", planSource: "none" };
  const channels = await getBufferChannels(organization.id);
  const isLikelyFree = organization.limits.channels === 3 && organization.limits.scheduledPosts <= 30;
  return { account: data.account, organization, channels, plan: isLikelyFree ? "Free (inferred)" : "Connected plan", planSource: isLikelyFree ? "Inferred from Buffer organization limits" : "Buffer organization limits" };
}

export async function getBufferChannels(organizationId: string) {
  const data = await bufferGraphQL<{ channels: BufferChannel[] }>(`
    query GetBufferChannels { channels(input: { organizationId: "${organizationId}" }) { id name displayName descriptor service avatar isDisconnected isLocked isQueuePaused externalLink } }
  `);
  return data.channels || [];
}

type Asset = { url: string; altText?: string };
export type ThreadItem = { text: string; imageUrl?: string; altText?: string };

function assetLiteral(asset: Asset) {
  const metadata = asset.altText ? `, metadata: { altText: ${JSON.stringify(asset.altText)} }` : "";
  return `{ image: { url: ${JSON.stringify(asset.url)}${metadata} } }`;
}

function threadMetadata(service: string, thread: ThreadItem[]) {
  if (!["twitter", "threads", "bluesky", "mastodon"].includes(service)) throw new Error(`${service} does not support threaded publishing through Web3 Pulse.`);
  const items = thread.map(item => `{ text: ${JSON.stringify(item.text)}, assets: [${item.imageUrl ? assetLiteral({ url: item.imageUrl, altText: item.altText }) : ""}] }`).join(" ");
  return `metadata: { ${service}: { thread: [${items}] } }`;
}

export async function createBufferPost(input: { channelId: string; service: string; text: string; mode: "shareNow" | "addToQueue" | "customScheduled"; dueAt?: string; imageUrl?: string; imageAltText?: string; thread?: ThreadItem[] }) {
  const dueAt = input.dueAt ? `dueAt: ${JSON.stringify(input.dueAt)}` : "";
  if (input.thread?.length) {
    if (input.thread[0].text !== input.text) throw new Error("The first thread item must match the master text.");
    const data = await bufferGraphQL<{ createPost: { post?: { id: string; text: string; dueAt: string | null; status: string }; message?: string } }>(`
      mutation CreateThreadedPost { createPost(input: { text: ${JSON.stringify(input.text)} channelId: ${JSON.stringify(input.channelId)} schedulingType: automatic mode: ${input.mode} ${dueAt} ${threadMetadata(input.service, input.thread)} }) { ... on PostActionSuccess { post { id text dueAt status } } ... on MutationError { message } } }
    `);
    if (!data.createPost?.post) throw new Error(data.createPost?.message || "Buffer could not create the thread.");
    return data.createPost.post;
  }
  const assets = input.imageUrl ? `assets: [${assetLiteral({ url: input.imageUrl, altText: input.imageAltText })}]` : "assets: []";
  const data = await bufferGraphQL<{ createPost: { post?: { id: string; text: string; dueAt: string | null; status: string }; message?: string } }>(`
    mutation CreateBufferPost { createPost(input: { text: ${JSON.stringify(input.text)} channelId: ${JSON.stringify(input.channelId)} schedulingType: automatic mode: ${input.mode} ${dueAt} ${assets} }) { ... on PostActionSuccess { post { id text dueAt status } } ... on MutationError { message } } }
  `);
  if (!data.createPost?.post) throw new Error(data.createPost?.message || "Buffer could not create the post.");
  return data.createPost.post;
}
