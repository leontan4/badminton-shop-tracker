import os

# Must be set before app.main is imported anywhere in the test suite --
# the auth middleware checks this to skip login enforcement entirely,
# since tests hit the API directly via TestClient and never log in.
os.environ["TESTING"] = "1"