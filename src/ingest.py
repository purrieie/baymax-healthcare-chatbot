from datasets import load_dataset

def load_pubmedqa(max_docs=1000):
    dataset = load_dataset("qiaojin/PubMedQA", "pqa_labeled", split="train")
    docs = []
    for item in dataset.select(range(min(max_docs, len(dataset)))):
        context = " ".join(item["context"]["contexts"])
        docs.append({
            "text": context,
            "question": item["question"],
            "pmid": str(item["pubid"]),
            "source": "pubmedqa"
        })
    print(f"✅ PubMedQA: {len(docs)} documents")
    return docs


def load_medquad(max_docs=2000):
    dataset = load_dataset("lavita/ChatDoctor-HealthCareMagic-100k", split="train")
    docs = []
    count = 0
    for item in dataset:
        if count >= max_docs:
            break
        if len(item["input"]) > 50:
            docs.append({
                "text": item["input"] + " " + item["output"],
                "question": item["input"],
                "pmid": f"hcm_{count}",
                "source": "healthcaremagic"
            })
            count += 1
    print(f"✅ HealthCareMagic: {len(docs)} documents")
    return docs


def load_all_documents():
    pubmed = load_pubmedqa(1000)
    medical = load_medquad(2000)
    all_docs = pubmed + medical
    print(f"✅ Total: {len(all_docs)} documents")
    return all_docs