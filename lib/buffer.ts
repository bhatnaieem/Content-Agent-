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
  limits: {
    channels: number;
    scheduledPosts: number;
  };
};

async function bufferGraphQL<T>(query: string) {
  const key = process.env.BUFFER_API_KEY;
  if (!key) throw new Error("Buffer is not configured. Add BUFFER_API_KEY in Vercel.");
  const response = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`Buffer API request failed (${response.status}).`);
  if (json.errors?.length) throw new Error(json.errors.map((e: { message?: string }) => e.message || "Buffer API error").join("; "));
  return json.data as T;
}

export async function getBufferWorkspace() {
  const data = await bufferGraphQL<{ account: { id: string; name: string; timezone: string; organizations: BufferOrganization[] } }>(`
    query GetBufferWorkspace {
      account {
        id
        name
        timezone
        organizations { id name channelCount limits { channels scheduledPosts } }
      }
    }
  `);
  const organizations = data.account.organizations || [];
  const organization = organizations[0];
  if (!organization) return { account: data.account, organization: null, channels: [], plan: "Not connected", planSource: "none" };
  const channels = await getBufferChannels(organization.id);
  const isLikelyFree = organization.limits.channels === 3 && organization.limits.scheduledPosts <= 30;
  return {
    account: data.account,
    organization,
    channels,
    plan: isLikelyFree ? "Free" : "Connected plan",
    planSource: isLikelyFree ? "Inferred from Buffer limits" : "Buffer organization limits",
  };
}

export async function getBufferChannels(organizationId: string) {
  const data = await bufferGraphQL<{ channels: BufferChannel[] }>(`
    query GetBufferChannels {
      channels(input: { organizationId: "${organizationId}" }) {
        id name displayName descriptor service avatar isDisconnected isLocked isQueuePaused externalLink
      }
    }
  `);
  return data.channels || [];
}

export async function createBufferPost(input: {
  channelId: string;
  text: string;
  mode: "shareNow" | "addToQueue" | "customScheduled";
  dueAt?: string;
  imageUrl?: string;
}) {
  const safeText = JSON.stringify(input.text);
  const safeChannel = JSON.stringify(input.channelId);
  const dueAt = input.dueAt ? `dueAt: ${JSON.stringify(input.dueAt)}` : "";
  const assets = input.imageUrl ? `assets: [{ image: { url: ${JSON.stringify(input.imageUrl)} } }]` : "";
  const data = await bufferGraphQL<{ createPost: { post?: { id: string; text: string; dueAt: string | null; status: string }; message?: string } }>(`
    mutation CreateBufferPost {
      createPost(input: {
        text: ${safeText}
        channelId: ${safeChannel}
        schedulingType: automatic
        mode: ${input.mode}
        ${dueAt}
        ${assets}
      }) {
        ... on PostActionSuccess { post { id text dueAt status } }
        ... on MutationError { message }
      }
    }
  `);
  if (!data.createPost?.post) throw new Error(data.createPost?.message || "Buffer could not create the post.");
  return data.createPost.post;
}
