import os
from dotenv import load_dotenv
import time

with open(".env", "a") as f:
    pass

load_dotenv()
print("Initial:", os.getenv("NIVEL_ALERTA_50"))

with open(".env", "w") as f:
    f.write("NIVEL_ALERTA_50=4.5\n")

print("After change but no reload:", os.getenv("NIVEL_ALERTA_50"))

load_dotenv(override=True)
print("After override=True:", os.getenv("NIVEL_ALERTA_50"))

