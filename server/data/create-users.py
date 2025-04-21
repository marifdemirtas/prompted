import random
import csv

# Set the course for all users
MAX_USERS = 50  # Number of users to generate

# Available LLM services
LLM_SERVICES = ["gemini-direct", "gemini-explanation", "gemini-scaffolding"]

# Predefined simple words (4–8 characters, easy to read)
WORD_LIST = [
    "apple", "baker", "candy", "delta", "eagle", "frost", "grape", "happy", 
    "island", "jolly", "kitten", "lemon", "monkey", "noodle", "orange", 
    "panda", "quartz", "rocket", "sunny", "tiger", "umbrella", "violet", 
    "whale", "xenon", "yellow", "zebra"
]

def generate_unique_phrase(existing):
    """Generates a unique username using two random words."""
    while True:
        username = f"{random.choice(WORD_LIST).capitalize()}{random.choice(WORD_LIST).capitalize()}"
        if username not in existing:
            return username

def assign_random_services():
    """Assigns random services to a user."""
    # Randomly decide how many services to assign (1-3)
    num_services = random.randint(1, len(LLM_SERVICES))
    # Randomly select services
    services = random.sample(LLM_SERVICES, num_services)
    # Randomly select a default service from the assigned services
    default_service = random.choice(services)
    return services, default_service

# Generate unique user records
students = []
usernames = set()

for _ in range(MAX_USERS):
    username = generate_unique_phrase(usernames)
    usernames.add(username)
    
    # Assign random services
    allowed_services, default_service = assign_random_services()

    students.append({
        "username": username,
        "allowedServices": ",".join(allowed_services),
        "defaultService": default_service
    })

# Write to CSV
csv_filename = "users.csv"
with open(csv_filename, "w", newline="") as csvfile:
    fieldnames = ["username", "allowedServices", "defaultService"]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(students)

print(f"Generated {len(students)} unique users in {csv_filename}")