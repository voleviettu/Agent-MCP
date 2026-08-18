export async function chat({ baseUrl, model, messages, tools }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer ollama" },
    body: JSON.stringify({ model, messages, tools, temperature: 0 }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("Model response did not contain a message");
  return message;
}

