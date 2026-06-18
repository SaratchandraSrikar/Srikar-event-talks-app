# BigQuery Release Pulse

A lightweight, modern web application that fetches, parses, and formats official Google Cloud BigQuery release notes, providing developers with a streamlined way to search updates and share key developments directly on X / Twitter.

Built using **Python Flask** on the backend and **plain vanilla HTML, CSS, and JavaScript** on the frontend.

---

## ✨ Key Features

*   **Atomic Feed Ingestion:** Automatically polls the Google Cloud BigQuery feed in real time.
*   **Granular Update Splitting:** Google bundles all notes published on a single calendar day together. The backend separates them into discrete cards (Features, Announcements, Changes, Deprecations, Issues) for easier reading, searching, and sharing.
*   **In-Memory API Caching:** Includes a 5-minute server-side memory cache with graceful fallback states to prevent redundant network requests and avoid API rate limits.
*   **Theme Toggle (Light/Dark):** Responsive styles styled with CSS custom variables, persisting your selection across page reloads via `localStorage`.
*   **Interactive Tweet Composer:**
    *   **Circular Progress Indicator:** An SVG ring mimics the native character limit tracker of X / Twitter, shifting colors as you near 280 characters.
    *   **Hashtag Helpers:** Single-click buttons to inject relevant tags like `#BigQuery` and `#GoogleCloud`.
    *   **Live Preview:** Instantly previews what your post will look like in a simulated feed timeline widget.
    *   **Twitter Intent Integration:** Opens drafts directly in a new X / Twitter composer tab safely without requiring Twitter API developer credentials.
*   **Zero External CSS/JS Library Dependencies:** Styled strictly with Vanilla CSS grids and flex layouts, using inline SVGs for fast, self-contained rendering.

---

## 📂 Project Structure

```text
agy-cli-projects/
│
├── app.py                  # Flask API server, Atom parser, and memory caching
├── requirements.txt        # Backend dependencies
├── .gitignore              # Files ignored by Git (venv, bytecode, environment variables)
├── README.md               # Project documentation
│
├── templates/
│   └── index.html          # Main application dashboard layout
│
└── static/
    ├── css/
    │   └── styles.css      # Design system variables, dark/light theme, custom animations
    └── js/
        └── app.js          # Client-side state, event handlers, search logic, and composer operations
```

---

## 🛠️ Installation & Getting Started

### Prerequisites
*   Python 3.10 or higher installed.
*   `pip` package manager.

### 1. Clone or Download the Directory
Navigate to the root directory where the files are stored:
```bash
cd agy-cli-projects
```

### 2. Install Dependencies
Install the required packages declared in `requirements.txt`:
```bash
pip install -r requirements.txt
```

### 3. Start the Server
Launch the Flask development server:
```bash
python app.py
```

### 4. Access the App
Open your web browser and go to:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## ⚙️ How it Works under the Hood

1.  **Feed Fetching:** When the page load completes or the refresh button is clicked, the client fires a `GET` request to the server's `/api/release-notes` API.
2.  **Splitting Multi-release Days:** The backend retrieves the XML feed, compiles the entries, and splits entries using regular expression boundaries matching `<h3>Category</h3>` blocks.
3.  **Client-side Sync:** The parsed JSON list is sent to `app.js` which manages rendering and filtering. 
4.  **Composition & Sharing:** When selecting a card to share, the JS script strips HTML formatting, pre-populates the sidebar text editor, checks length limitations, and passes the URL-encoded string to Twitter's web intent (`https://twitter.com/intent/tweet?text=...`) when you hit submit.
