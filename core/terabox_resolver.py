import sys
import json
import os
import io

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)

    url = sys.argv[1].strip()
    
    cookie_str = ""
    if len(sys.argv) > 2 and sys.argv[2]:
        cookie_str = sys.argv[2]
    else:
        for candidate in ["terabox_cookie.txt", "cookies.txt"]:
            if os.path.exists(candidate):
                try:
                    with open(candidate, "r", encoding="utf-8") as f:
                        cookie_str = f.read().strip()
                    break
                except Exception:
                    pass
    
    if not cookie_str:
        cookie_str = "lang=en;"

    # Capture any banner prints from third party libraries
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    try:
        from TeraboxDL import TeraboxDL
        tb = TeraboxDL(cookie_str)
        info = tb.get_file_info(url)
    except Exception as e:
        info = {"error": str(e)}
    finally:
        sys.stdout = old_stdout

    print(json.dumps(info))

if __name__ == "__main__":
    main()
