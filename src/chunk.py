from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_documents(docs, chunk_size=500, overlap=50):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap
    )
    
    chunks = []
    for doc in docs:
        splits = splitter.split_text(doc["text"])
        for i, split in enumerate(splits):
            chunks.append({
                "text": split,
                "pmid": doc["pmid"],
                "chunk_id": f"{doc['pmid']}_{i}"
            })
    
    print(f"✅ Created {len(chunks)} chunks from {len(docs)} docs")
    return chunks