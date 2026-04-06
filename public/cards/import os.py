import os
import json

CARD_PATH = r"C:\Users\DESKTOP\Desktop\lycee\cardlist"

# 기본 카드 템플릿
def create_default_card(card_id):
    return {
        "id": card_id,
        "name": f"Card {card_id}",
        "cost": 0,
        "attack": 0,
        "defense": 0,
        "skill": None,
        "description": ""
    }

for file in os.listdir(CARD_PATH):
    if file.endswith(".png"):
        card_id = file.replace(".png", "")
        json_path = os.path.join(CARD_PATH, f"{card_id}.json")
        
        # JSON 없으면 생성
        if not os.path.exists(json_path):
            data = create_default_card(card_id)
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
                
            print(f"생성됨: {card_id}.json")