<div dir="rtl" align="right">

# Postman Collections — AuraMeet AI

תיקייה זו מכילה אוספי `Postman` עצמאיים (`Collections`) לכל 5 המיקרוסרוויסים + `API Gateway`, תחת `postman/collections/` — **ללא צורך ב-`Environments`**. כל המשתנים (`base_url`, `ws_url`, `jwt_token`, `persona_id`, `session_id`, `template_id`, `meeting_id`) מוגדרים ישירות כ-`Collection Variables` ומתעדכנים אוטומטית בסקריפטים (`pm.collectionVariables.set`).

## קבצי האוספים (`postman/collections/`)
1. **`AuraMeet-AI-Docker-Localhost.postman_collection.json`** — מוכן לעבודה מקומית מול `Docker Compose` (`http://localhost:8088`).
2. **`AuraMeet-AI-Render-Production.postman_collection.json`** — מוכן לעבודה מול הפריסה החיה ב-`Render` (`https://aurameet-gateway.onrender.com`).

## איך לייבא ל-Postman
1. פתח את **Postman** ולחץ **Import**.
2. גרור פנימה את הקבצים מהתיקייה `postman/collections/` — שניהם יופיעו ישירות בלשונית **Collections**.
3. אם ב-`Render` הכתובת כוללת סיומת מותאמת, עדכן את `base_url` ו-`ws_url` בלשונית **Variables** של ה-Collection.
4. הרץ את **`Login User`** — סקריפט הבדיקה ישמור אוטומטית את ה-`JWT` למשתנה `{{jwt_token}}` של ה-Collection לכל הבקשות הבאות!

</div>
