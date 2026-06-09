from sentence_transformers import SentenceTransformer
import chromadb

def build_vectorstore(chunks, collection_name="clinical_rag"):
    # Load embedding model
    model = SentenceTransformer("all-MiniLM-L6-v2")
    
    # Setup ChromaDB (saves locally)
    client = chromadb.PersistentClient(path="./data/chroma")
    
    # Fresh collection har baar
    try:
        client.delete_collection(collection_name)
    except:
        pass
    collection = client.create_collection(collection_name)
    
    # Embed and store in batches
    texts = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = [{"pmid": c["pmid"], "source": c.get("source", "unknown")} for c in chunks]

    print("Embedding chunks...")
    embeddings = model.encode(texts, show_progress_bar=True).tolist()

    # Add in batches of 2000
    batch_size = 2000
    for i in range(0, len(texts), batch_size):
        collection.add(
            documents=texts[i:i+batch_size],
            embeddings=embeddings[i:i+batch_size],
            ids=ids[i:i+batch_size],
            metadatas=metadatas[i:i+batch_size]
        )
        print(f"  Stored batch {i//batch_size + 1}")

    print(f"✅ Stored {collection.count()} chunks in ChromaDB")
    return collection, model


def get_vectorstore(collection_name="clinical_rag"):
    client = chromadb.PersistentClient(path="./data/chroma")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    collection = client.get_collection(collection_name)
    return collection, model


def search(query, collection, model, top_k=3):
    query_embedding = model.encode([query]).tolist()
    results = collection.query(query_embeddings=query_embedding, n_results=top_k)
    
    hits = []
    for i in range(len(results["documents"][0])):
        hits.append({
            "text": results["documents"][0][i],
            "pmid": results["metadatas"][0][i]["pmid"],
            "score": round((2 - results["distances"][0][i]) / 2, 3)
        })
    return hits