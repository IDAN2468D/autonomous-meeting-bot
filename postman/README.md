<div dir="rtl" align="right">

# Postman Collection & Environments — AuraMeet AI

תיקייה זו מכילה אוסף `Postman` מלא לכל 5 המיקרוסרוויסים + `API Gateway`, עם **שתי סביבות מוכנות למעבר בלחיצה אחת**:

1. **`AuraMeet — Docker Localhost`** (`http://localhost:8088`) — לבדיקות מקומיות עם `docker compose up`.
2. **`AuraMeet — Render Production`** (`https://aurameet-gateway.onrender.com`) — לבדיקות מול הפריסה החיה ב-`Render`.

## איך לייבא ל-Postman
1. פתח את **Postman** ולחץ **Import**.
2. גרור פנימה את הקבצים הבאים מהתיקייה `postman/`:
   - `AuraMeet-AI-Microservices.postman_collection.json`
   - `environments/AuraMeet-Docker-Localhost.postman_environment.json`
   - `environments/AuraMeet-Render-Production.postman_environment.json`
3. בפינה הימנית העליונה של `Postman` בחר בסביבה הרצויה (`Docker Localhost` או `Render Production`).
4. אם ב-`Render` ה-URL של `aurameet-gateway` כולל סיומת מותאמת, עדכן רק את `base_url` ו-`ws_url` בסביבת `Render Production`.
5. הרץ את **`Login User`** — סקריפט הבדיקה ישמור אוטומטית את ה-`JWT` למשתנה `{{jwt_token}}` לכל הבקשות הבאות!

</div>
