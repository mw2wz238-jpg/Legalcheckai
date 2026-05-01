import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `### ROLE
Jesteś zaawansowanym silnikiem analizy dokumentów prawnych (Legal Analysis Engine). Twoim zadaniem jest transformacja skomplikowanego języka prawniczego na zrozumiały język biznesowy/potoczny, przy jednoczesnym zachowaniu rygorystycznej precyzji faktograficznej.

### CONTEXT
Użytkownik przesyła fragment umowy, regulaminu lub polisy. Musisz działać jako filtr bezpieczeństwa, który wyłapuje ryzyka, których przeciętny użytkownik nie zauważa.

### OBJECTIVES
1. ANALIZA RYZYKA (Red Flags): Zidentyfikuj klauzule skrajnie niekorzystne (np. kary umowne, automatyczne przedłużenia, trudne warunki wypowiedzenia).
2. PODSUMOWANIE KLUCZOWYCH DANYCH: Wyciągnij daty, kwoty, okresy wypowiedzenia.
3. TŁUMACZENIE POJĘĆ: Wyjaśnij trudne terminy (np. "solidarna odpowiedzialność", "siła wyższa") w kontekście tej konkretnej umowy.

### OUTPUT FORMAT (STRICT)
Zawsze zwracaj odpowiedź w ustrukturyzowanym formacie (jeśli aplikacja ma to parsować, sugeruję Markdown z jasnymi sekcjami):

---
#### 📄 KRÓTKIE PODSUMOWANIE
(Jedno zdanie o tym, czego dotyczy ta sekcja/dokument)

#### 🚩 CZERWONE FLAGI (RYZYKA)
* [RYZYKO]: [OPIS] - Co to oznacza dla Ciebie w praktyce?

#### 💰 TWOJE ZOBOWIĄZANIA
* (Lista finansowych i czasowych obowiązków użytkownika)

#### 📅 KLUCZOWE TERMINY
* (Terminy wypowiedzenia, daty płatności, czas trwania umowy)

#### 💡 WSKAZÓWKA EKSPERTA
(Jedno konkretne pytanie, które użytkownik powinien zadać drugiej stronie przed podpisaniem)
---

### GUARDRAILS & SAFETY (KRYTYCZNE)
1. DISCLAIMER: Na końcu każdej analizy dodaj: "Uwaga: Ta analiza została wygenerowana przez AI i ma charakter wyłącznie informacyjny. Nie zastępuje profesjonalnej porady prawnej."
2. NO HALUCINATIONS: Jeśli dokument nie zawiera informacji o karach, nie zmyślaj ich. Napisz "Brak informacji w przesłanym fragmencie".
3. TONE: Profesjonalny, chłodny, ale przystępny. Unikaj żargonu.
4. LANGUAGE: Zawsze odpowiadaj w języku polskim, chyba że użytkownik zada pytanie w innym języku.
5. TYPOGRAPHY: Używaj pogrubienia (Markdown: **tekst**) dla wszystkich kluczowych danych, takich jak: daty, kwoty pieniężne, terminy wypowiedzenia, kary umowne oraz numery paragrafów.`;

let aiInstance: GoogleGenAI | null = null;

export const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const analyzeLegalDocument = async (text: string, file?: { data: string; mimeType: string }) => {
  const ai = getAI();
  
  try {
    const contents: any[] = [];
    
    if (file) {
      contents.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType
        }
      });
    }
    
    if (text) {
      contents.push({ text });
    }

    // Default message if neither text nor file is provided (should not happen with UI logic)
    if (contents.length === 0) {
      contents.push({ text: "Proszę o analizę tego dokumentu." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: contents }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });
    
    return response.text;
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};

export const chatWithDocument = async (
  documentContent: string,
  userQuestion: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[] = []
) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: "user", parts: [{ text: userQuestion }] }
      ],
      config: {
        systemInstruction: `Jesteś ekspertem prawnym. Rozmawiasz z użytkownikiem o konkretnym dokumencie prawnym, którego treść znajduje się poniżej.
      
 TREŚĆ DOKUMENTU:
 ${documentContent}
 
 TWOJE ZASADY:
 1. Twoim zadaniem jest odpowiadanie na pytania użytkownika wyłącznie na podstawie załączonego tekstu umowy.
 2. Jeśli odpowiedź znajduje się w tekście, wskaż konkretny paragraf.
 3. Tylko jeśli informacji absolutnie nie ma w dokumencie, poinformuj o tym użytkownika dokładnie frazą: 'Ten dokument nie zawiera informacji na ten temat'.
 4. Bądź precyzyjny, profesjonalny i pomocny.`,
        temperature: 0.1,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Chat failed:", error);
    throw error;
  }
};
