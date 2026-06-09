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
    prompt = f"""You are a helpful clinical assistant. Answer clearly and simply.
Use bullet points where helpful. Keep language simple and easy to understand.
Cite PMID numbers inline like (PMID: 12345).
If information is not in context, say so briefly.


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