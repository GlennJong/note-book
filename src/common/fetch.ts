type RawData = Record<string, any>;
type Data = RawData;

export const fetchScript = async (url: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<Data[]> => {
  const options: RequestInit = { method };
  if (method === 'POST' && body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const json = await res.json();
  
  // Safety check: ensure data exists and is an array
  const data: RawData[] = Array.isArray(json.data) ? json.data : [];
  
  return data.map((item: RawData) => {
    // If tags is a string, split it
    const tags = typeof item.tags === 'string' ? item.tags.split(',') : (item.tags || []);
    return { 
        ...item, 
        tags 
    };
  });
};