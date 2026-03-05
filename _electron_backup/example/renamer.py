import os

FOLDER = r"D:\Personal Works\Experimental\Kodo\manga\Troublesome Employee Warning (Uncensored)"  # <-- GANTI ke folder kamu
BASE_NAME = "Troublesome Employee Warning (Uncensored)"         # <-- Nama judul yang kamu mau

files = [f for f in os.listdir(FOLDER) if f.lower().endswith(".cbz")]
files.sort()

for i, old_name in enumerate(files, start=1):
    new_name = f"{BASE_NAME} - {i:02d}.cbz"

    old_path = os.path.join(FOLDER, old_name)
    new_path = os.path.join(FOLDER, new_name)

    if old_name != new_name:
        print(f"{old_name} -> {new_name}")
        os.rename(old_path, new_path)

print("Selesai ✅")