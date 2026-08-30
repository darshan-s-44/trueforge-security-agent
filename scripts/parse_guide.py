import docx
import sys

sys.stdout.reconfigure(encoding='utf-8')

doc = docx.Document(r'C:\4th_year\hackathon\trueforge\TrueForge_Hackathon_Guide.docx')
print("=== HACKATHON GUIDE SUBMISSION & REPO INSTRUCTIONS ===")
for p in doc.paragraphs:
    text = p.text.strip()
    if text:
        print(text)
