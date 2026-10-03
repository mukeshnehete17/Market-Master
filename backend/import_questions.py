"""Authoritative importer for Market Master 40 Questions.

Source of truth: data/Entrepreneurship_GK_40_MCQ_Questions.docx
Idempotent: Uses deterministic UUIDs (c0000000-0000-0000-0000-000000000001..40).
Running multiple times is completely safe and updates existing records in place.
"""

import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.supabase_db import get_supabase_client, is_supabase_configured

DOCX_CANDIDATE_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "data", "Entrepreneurship_GK_40_MCQ_Questions.docx"),
    os.path.join(os.path.dirname(__file__), "data", "Entrepreneurship_GK_40_MCQ_Questions.docx"),
    "/Users/krishna/Downloads/Entrepreneurship_GK_40_MCQ_Questions.docx",
]


def find_docx_path():
    for p in DOCX_CANDIDATE_PATHS:
        if os.path.exists(p):
            return os.path.abspath(p)
    raise FileNotFoundError("Could not locate Entrepreneurship_GK_40_MCQ_Questions.docx")


def parse_docx(docx_path):
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml")
        tree = ET.fromstring(xml_content)
        paragraphs = []
        for p in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
            texts = [t.text for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text]
            if texts:
                paragraphs.append("".join(texts).strip())

    current_category = "Entrepreneurship"
    questions = []
    current_q = None

    for p in paragraphs:
        if p.lower() == "entrepreneurship":
            current_category = "Entrepreneurship"
            continue
        elif "general knowledge" in p.lower() and not re.match(r"^\d+\.", p):
            current_category = "General Knowledge"
            continue

        q_match = re.match(r"^(\d+)\.\s*(.+)", p)
        if q_match:
            q_num = int(q_match.group(1))
            q_text = q_match.group(2).strip()
            current_q = {
                "number": q_num,
                "question_text": q_text,
                "category": current_category,
                "options": {},
                "correct_option": None,
                "duration_seconds": 15,
                "is_active": True,
            }
            questions.append(current_q)
            continue

        opt_match = re.match(r"^([A-D])\.\s*(.+)", p)
        if opt_match and current_q:
            opt_letter = opt_match.group(1)
            opt_text = opt_match.group(2).strip()
            current_q["options"][opt_letter] = opt_text
            continue

        ans_match = re.match(r"^Answer:\s*([A-D])", p, re.IGNORECASE)
        if ans_match and current_q:
            current_q["correct_option"] = ans_match.group(1).upper()
            continue

    if len(questions) != 40:
        raise ValueError(f"Expected 40 questions from docx, found {len(questions)}")

    return questions


def run_import():
    docx_path = find_docx_path()
    print(f"Reading authoritative question bank from: {docx_path}")
    raw_questions = parse_docx(docx_path)
    print(f"Successfully parsed {len(raw_questions)} questions from DOCX.")

    if not is_supabase_configured():
        print("ERROR: Supabase credentials not configured in backend/.env")
        sys.exit(1)

    client = get_supabase_client()
    if not client:
        print("ERROR: Could not establish Supabase client.")
        sys.exit(1)

    print("Connected to Supabase. Step 1: Cleaning up obsolete test games and mock questions...")

    # 1. Clean up old test games referencing legacy/mock questions
    test_games = client.table("games").select("id, game_pin, name").execute().data or []
    for g in test_games:
        name_lower = str(g.get("name", "")).lower()
        pin = str(g.get("game_pin", "")).upper()
        if "test" in name_lower or "verify" in name_lower or pin in ("XQPM7D", "VERIFY1", "VERIFY2") or name_lower == "reghsdfs":
            print(f"Removing test game: {g.get('id')} ({g.get('name')}, PIN: {pin})")
            client.table("games").delete().eq("id", g["id"]).execute()

    # 2. Clean up any remaining legacy questions
    existing_q = client.table("questions").select("id, question_text, category").execute().data or []
    for eq in existing_q:
        q_id = str(eq.get("id", ""))
        # If it is not one of our deterministic IDs (c0000000-0000-0000-0000-000000000001..40), delete it
        if not q_id.startswith("c0000000-0000-0000-0000-"):
            print(f"Removing obsolete question: {q_id} ({eq.get('question_text')[:40]}...)")
            client.table("questions").delete().eq("id", q_id).execute()

    print("Step 2: Upserting 40 authoritative questions with duration = 15s...")

    payload_rows = []
    for q in raw_questions:
        q_num = q["number"]
        deterministic_id = f"c0000000-0000-0000-0000-{q_num:012d}"
        correct_letter = q["correct_option"]
        correct_text = q["options"][correct_letter]

        row = {
            "id": deterministic_id,
            "question_text": q["question_text"],
            "option_a": q["options"]["A"],
            "option_b": q["options"]["B"],
            "option_c": q["options"]["C"],
            "option_d": q["options"]["D"],
            "correct_option": correct_text,
            "category": q["category"],
            "duration_seconds": 15,
            "is_active": True,
        }
        payload_rows.append(row)

    # Upsert in batches of 10 to ensure smooth network payload
    batch_size = 10
    for i in range(0, len(payload_rows), batch_size):
        batch = payload_rows[i:i + batch_size]
        client.table("questions").upsert(batch).execute()
        print(f"Upserted questions {i + 1} to {min(i + batch_size, len(payload_rows))}")

    print("Step 3: Validating database state...")
    verify_resp = client.table("questions").select("id, question_text, category, duration_seconds, is_active, correct_option").execute()
    db_questions = verify_resp.data or []

    print(f"Total questions in database: {len(db_questions)}")

    cat_counts = {}
    duration_errors = []
    inactive_errors = []
    missing_fields = []

    for q in db_questions:
        cat = q.get("category", "")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        if q.get("duration_seconds") != 15:
            duration_errors.append((q["id"], q.get("duration_seconds")))
        if not q.get("is_active"):
            inactive_errors.append(q["id"])
        if not q.get("correct_option"):
            missing_fields.append((q["id"], "missing correct_option"))

    print("Category breakdown:", cat_counts)

    assert len(db_questions) == 40, f"Expected exactly 40 questions, found {len(db_questions)}"
    assert cat_counts.get("Entrepreneurship") == 20, f"Expected 20 Entrepreneurship, found {cat_counts.get('Entrepreneurship')}"
    assert cat_counts.get("General Knowledge") == 20, f"Expected 20 General Knowledge, found {cat_counts.get('General Knowledge')}"
    assert len(duration_errors) == 0, f"Duration errors found: {duration_errors}"
    assert len(inactive_errors) == 0, f"Inactive questions found: {inactive_errors}"
    assert len(missing_fields) == 0, f"Missing fields found: {missing_fields}"

    print("============================================================")
    print("SUCCESS: 40 REAL QUESTIONS IMPORTED AND VALIDATED IN SUPABASE")
    print("============================================================")


if __name__ == "__main__":
    run_import()
