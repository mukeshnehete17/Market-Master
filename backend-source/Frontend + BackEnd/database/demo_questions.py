"""Demo questions repository for Knowledge Exchange.
Provides a curated set of questions covering technology, science, and general knowledge.
"""

questions = [
    {
        "id": 1,
        "question": "Which programming language was created by Guido van Rossum and first released in 1991?",
        "options": ["Python", "Java", "Ruby", "C++"],
        "answer": "Python",
        "duration_seconds": 15,
        "explanation": "Guido van Rossum developed Python in the late 1980s at CWI in the Netherlands and released it in February 1991."
    },
    {
        "id": 2,
        "question": "What is the primary protocol used to securely transmit web pages over the internet?",
        "options": ["HTTP", "HTTPS", "FTP", "SMTP"],
        "answer": "HTTPS",
        "duration_seconds": 30,
        "explanation": "HTTPS (Hypertext Transfer Protocol Secure) encrypts communications using Transport Layer Security (TLS)."
    },
    {
        "id": 3,
        "question": "In computer science, what is the time complexity of searching in a balanced Binary Search Tree (BST)?",
        "options": ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
        "answer": "O(log n)",
        "duration_seconds": 10,
        "explanation": "Because a balanced BST halves the search space at each level, the height is logarithmic in relation to n."
    },
    {
        "id": 4,
        "question": "Which planet in our solar system has the highest number of confirmed moons?",
        "options": ["Jupiter", "Saturn", "Uranus", "Neptune"],
        "answer": "Saturn",
        "duration_seconds": 45,
        "explanation": "With over 140 confirmed moons, Saturn currently holds the record for the most moons in our solar system."
    },
    {
        "id": 5,
        "question": "Which element has the highest electrical conductivity of all metals at room temperature?",
        "options": ["Gold", "Copper", "Silver", "Aluminum"],
        "answer": "Silver",
        "duration_seconds": 15,
        "explanation": "Silver has the highest electrical and thermal conductivity of all known elements, though copper is more commonly used due to cost."
    },
    {
        "id": 6,
        "question": "What does 'API' stand for in software engineering?",
        "options": [
            "Application Programming Interface",
            "Advanced Process Integration",
            "Automated Program Interaction",
            "Applied Protocol Interface"
        ],
        "answer": "Application Programming Interface",
        "duration_seconds": 20,
        "explanation": "An API is a defined set of rules and specifications that software programs follow to communicate with each other."
    },
    {
        "id": 7,
        "question": "Which lightweight data-interchange format uses human-readable text inspired by JavaScript object literals?",
        "options": ["XML", "YAML", "JSON", "CSV"],
        "answer": "JSON",
        "duration_seconds": 25,
        "explanation": "JSON (JavaScript Object Notation) is a ubiquitous, lightweight data format popularized by Douglas Crockford."
    },
    {
        "id": 8,
        "question": "What is the chemical formula for ordinary table salt?",
        "options": ["NaCl", "KCl", "CaCl2", "Na2SO4"],
        "answer": "NaCl",
        "duration_seconds": 10,
        "explanation": "Common table salt is composed of sodium and chlorine ions in a 1:1 ratio forming Sodium Chloride (NaCl)."
    }
]

QUESTIONS = questions
