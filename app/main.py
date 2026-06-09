from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.vectorstore import get_vectorstore
from src.rag import build_rag_chain, answer_question

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Load once at startup
collection, model = get_vectorstore()
llm = build_rag_chain()

class Query(BaseModel):
    question: str

class ReportScan(BaseModel):
    filename: str
    data: str
    type: str

@app.get("/")
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")

@app.post("/scan-report")
async def scan_report(scan: ReportScan):
    prompt = f"""You are a medical report analyzer. The user uploaded '{scan.filename}'.
Analyze it as a medical/blood test report. For each parameter found, format EXACTLY like:

1. Parameter Name: value (Normal range: X-Y units)
- ABNORMAL: one sentence explanation. OR - NORMAL: one sentence explanation.
- Recommendation: one sentence.

Keep language simple. If not a medical report, say so."""

    response = llm.invoke(prompt)
    return {"analysis": response.content}

@app.post("/ask")
async def ask(query: Query):
    result = answer_question(query.question, collection, model, llm)
    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "chunks": [{"text": c["text"][:200], "pmid": c["pmid"].replace("hcm_", "HCM-"), "score": c["score"]}
                   for c in result["chunks"]]
    }

class SymptomQuery(BaseModel):
    symptoms: str

@app.post("/analyze-symptoms")
async def analyze_symptoms(query: SymptomQuery):
    prompt = f"""Patient symptoms: {query.symptoms}.

List exactly 3 possible conditions. Use EXACTLY this format for each:

1. Condition Name
Severity: mild
Explanation: One sentence about why this matches the symptoms.

2. Condition Name
Severity: moderate
Explanation: One sentence about why this matches the symptoms.

3. Condition Name
Severity: serious
Explanation: One sentence about why this matches the symptoms.

Do not add any intro text, bullet points, PMIDs, or extra formatting."""
    
    response = llm.invoke(prompt)
    return {"analysis": response.content}

@app.get("/insights")
async def get_insights():
    import asyncio
    
    prompts = [
        {"topic": "Did You Know?", "question": "Share one surprising health fact in exactly 2 short sentences. Be warm and friendly. No bullet points."},
        {"topic": "Today's Tip", "question": "Give one simple actionable wellness tip for today in exactly 2 short sentences. Be encouraging. No bullet points."},
        {"topic": "Quick Reminder", "question": "Give one gentle health reminder in exactly 2 short sentences. Be kind. No bullet points."}
    ]
    
    async def fetch_one(p):
        loop = asyncio.get_event_loop()
        r = await loop.run_in_executor(None, lambda: llm.invoke(p["question"]))
        return {"topic": p["topic"], "insight": r.content}
    
    results = await asyncio.gather(*[fetch_one(p) for p in prompts])
    return {"insights": list(results)}