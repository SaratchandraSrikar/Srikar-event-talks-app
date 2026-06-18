import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Constants
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_EXPIRY_SECONDS = 300  # 5 minutes cache

# Memory Cache
cache = {
    "data": None,
    "last_fetched": 0
}

def strip_html(html_str):
    if not html_str:
        return ""
    # Add spacing for blocks
    text = re.sub(r'</?(p|div|br|h1|h2|h3|h4|h5|h6|li|tr)[^>]*>', '\n', html_str)
    # Strip HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode common HTML entities
    entities = {
        "&nbsp;": " ",
        "&lt;": "<",
        "&gt;": ">",
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&#39;": "'"
    }
    for ent, char in entities.items():
        text = text.replace(ent, char)
    # Clean up whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n\n', text)
    return text.strip()

def fetch_and_parse_feed():
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        xml_data = response.content
        
        root = ET.fromstring(xml_data)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = root.findall('atom:entry', ns)
        parsed_updates = []
        
        pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL)
        
        for entry_idx, entry in enumerate(entries):
            day_id = entry.find('atom:id', ns).text or f"id-{entry_idx}"
            date_str = entry.find('atom:title', ns).text or "Unknown Date"
            updated_str = entry.find('atom:updated', ns).text or ""
            content_el = entry.find('atom:content', ns)
            
            content_html = content_el.text if content_el is not None else ""
            
            # Split the entry into individual updates if it contains <h3> categories
            matches = pattern.findall(content_html)
            
            if matches:
                for sub_idx, (category, body) in enumerate(matches):
                    category_clean = category.strip()
                    body_clean = body.strip()
                    
                    parsed_updates.append({
                        "id": f"{day_id}_{sub_idx}",
                        "date": date_str,
                        "updated": updated_str,
                        "category": category_clean,
                        "content_html": body_clean,
                        "content_text": strip_html(body_clean)
                    })
            else:
                # Fallback if no <h3> tags are present
                parsed_updates.append({
                    "id": day_id,
                    "date": date_str,
                    "updated": updated_str,
                    "category": "General",
                    "content_html": content_html,
                    "content_text": strip_html(content_html)
                })
                
        return parsed_updates
        
    except Exception as e:
        print(f"Error fetching/parsing feed: {e}")
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    now = time.time()
    
    # Check if cache is valid
    if cache["data"] is not None and (now - cache["last_fetched"]) < CACHE_EXPIRY_SECONDS:
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_fetched": cache["last_fetched"],
            "data": cache["data"]
        })
        
    try:
        data = fetch_and_parse_feed()
        cache["data"] = data
        cache["last_fetched"] = now
        return jsonify({
            "status": "success",
            "source": "live",
            "last_fetched": now,
            "data": data
        })
    except Exception as e:
        # Fallback to cache if request fails and cache exists
        if cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to fetch live feed. Showing cached data. Error: {str(e)}",
                "source": "cache_fallback",
                "last_fetched": cache["last_fetched"],
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch release notes: {str(e)}"
        }), 500

@app.route('/api/release-notes/force-refresh')
def force_refresh_release_notes():
    try:
        data = fetch_and_parse_feed()
        now = time.time()
        cache["data"] = data
        cache["last_fetched"] = now
        return jsonify({
            "status": "success",
            "source": "live_refresh",
            "last_fetched": now,
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to refresh release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
