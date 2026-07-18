import json
import sys

def extract_pdf_content(transcript_path, output_path):
    pdf_content = []
    in_pdf = False
    
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if 'content' in data:
                    content = data['content']
                    if '==Start of PDF==' in content:
                        start_idx = content.find('==Start of PDF==')
                        end_idx = content.find('==End of PDF==')
                        if end_idx != -1:
                            pdf_content.append(content[start_idx:end_idx])
                        else:
                            pdf_content.append(content[start_idx:])
                            in_pdf = True
                    elif in_pdf:
                        end_idx = content.find('==End of PDF==')
                        if end_idx != -1:
                            pdf_content.append(content[:end_idx])
                            in_pdf = False
                        else:
                            pdf_content.append(content)
            except Exception as e:
                pass

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(pdf_content))
        
if __name__ == '__main__':
    transcript_file = r"C:\Users\mokaa\.gemini\antigravity-ide\brain\ee34b4ab-bcaf-4202-afb1-ab82a34e1820\.system_generated\logs\transcript_full.jsonl"
    output_file = r"C:\Users\mokaa\.gemini\antigravity-ide\scratch\tnea-counselling-app\pdf_content.txt"
    extract_pdf_content(transcript_file, output_file)
    print("Extraction complete.")
