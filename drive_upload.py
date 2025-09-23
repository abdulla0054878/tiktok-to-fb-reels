# drive_upload.py
import os
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2 import service_account

def upload_file(filepath, folder_id=None):
    # Railway Env থেকে service account JSON নিবে
    service_json = os.getenv("GDRIVE_SERVICE_JSON")
    with open("service.json", "w") as f:
        f.write(service_json)

    creds = service_account.Credentials.from_service_account_file("service.json")
    service = build("drive", "v3", credentials=creds)

    file_metadata = {"name": os.path.basename(filepath)}
    if folder_id:
        file_metadata["parents"] = [folder_id]

    media = MediaFileUpload(filepath, resumable=True)
    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields="id,webViewLink"
    ).execute()
    return file
