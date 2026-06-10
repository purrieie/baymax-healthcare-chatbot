from langchain_groq import ChatGroq
from dotenv import load_dotenv
import os

load_dotenv()

def build_rag_chain():
    llm = ChatGroq(
        model="llama-3.1-8b-instant",
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.1
    )
    return llm

def answer_question(query, collection, model, llm):
    # Step 1: retrieve relevant chunks
    from src.vectorstore import search
    hits = search(query, collection, model, top_k=3)
    
    # Step 2: build context
    context = "\n\n".join([f"[PMID {h['pmid']}]: {h['text']}" for h in hits])
    
    # Step 3: prompt
    prompt = f"""You are a clinical assistant.keep the tone warm and conversational. dont use technical jargon. don't diagnose with extreme conditions immediately, keep tone warm. Answer the question based on the context below.

Format your answer like this:
- console the patient first, then answer the question in a clear and concise manner.
- Start with a one-line summary, 
- Use clear bullet points
- Keep language simple
- End with: "📄 Based on: PMID xxxxx"

If not enough info, say: "I don't have enough information on this topic."


Context:
{context}

Question: {query}

Answer:"""
    
    response = llm.invoke(prompt)
    
    return {
        "answer": response.content,
        "sources": [h["pmid"] for h in hits],
        "chunks": hits
    }