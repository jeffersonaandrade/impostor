import Groq from "groq-sdk";

// Verificar se a chave da API está configurada
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY não está definida nas variáveis de ambiente");
}

// Inicializar cliente Groq
export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Modelo atualizado - versão mais recente e estável
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Gera uma palavra secreta e categoria baseada no tema fornecido
 * @param theme - Tema do jogo (ex: "Séries dos anos 90")
 * @param forbiddenWords - Array de palavras que não podem ser usadas (já usadas anteriormente)
 * @returns Objeto com secret_word e category
 */
export async function generateSecretWord(theme: string, forbiddenWords: string[] = []): Promise<{
  secret_word: string;
  category: string;
}> {
  const systemPrompt = `Você é um mestre de jogo. Retorne APENAS um JSON válido no formato: { "secret_word": "...", "category": "..." } baseado no tema fornecido pelo usuário. A palavra secreta deve ser algo específico e interessante relacionado ao tema. A categoria deve ser uma descrição breve do tema.`;

  // Construir mensagem do usuário com lista de palavras proibidas
  let userMessage = `Tema: ${theme}`;
  
  if (forbiddenWords.length > 0) {
    const forbiddenList = forbiddenWords.slice(0, 20).join(", "); // Limitar a 20 para não exceder tokens
    userMessage += `\n\nIMPORTANTE: A palavra secreta NÃO PODE ser nenhuma das seguintes palavras já usadas: ${forbiddenList}. Gere uma palavra NOVA e DIFERENTE relacionada ao tema.`;
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      model: GROQ_MODEL, // Modelo explícito: llama-3.3-70b-versatile
      temperature: 0.6, // Balance entre criatividade e precisão
      max_tokens: 200,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Resposta vazia da Groq API");
    }

    try {
      const result = JSON.parse(content);
      if (!result.secret_word || !result.category) {
        throw new Error("Formato de resposta inválido: campos secret_word ou category ausentes");
      }
      return result;
    } catch (parseError) {
      throw new Error(`Erro ao parsear resposta da Groq: ${parseError}`);
    }
  } catch (error: any) {
    console.error("Erro na chamada da Groq API:", error);
    if (error.message?.includes("model_decommissioned") || error.message?.includes("model")) {
      throw new Error(`Erro com o modelo da Groq. Modelo configurado: ${GROQ_MODEL}. Erro: ${error.message}`);
    }
    throw error;
  }
}
