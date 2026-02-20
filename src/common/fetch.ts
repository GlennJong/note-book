type RawData = Record<string, any>;
type Data = RawData;

export const fetchScript = async (url: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<Data[]> => {
  const options: RequestInit = { method };
  if (method === 'POST' && body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  
  // Try to parse JSON, if fails, return empty array (assuming success for POST)
  let json: any = {};
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    if (method === 'POST') {
        return []; // Assume success for write operations that return text
    }
    console.error("Failed to parse response", text);
    throw e;
  }
  
  // Safety check: ensure data exists and is an array
  const data: RawData[] = Array.isArray(json.data) ? json.data : [];
  
  return data.map((item: RawData) => {
    // If tags is a string, split it and filter out empty strings
    const rawTags = typeof item.tags === 'string' ? item.tags.split(',') : (item.tags || []);
    const tags = rawTags.map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    return { 
        ...item, 
        tags 
    };
  });
};