from setuptools import setup, find_packages


setup(
    name="subl",
    version="0.1.8",
    author="Matthew Tang and Dylan Bowman",
    author_email="founders@sublingual.ai",
    description="No-code LLM production app evals.",
    url="https://github.com/sublingual-ai/sublingual",
    packages=find_packages(),
    entry_points={
        "console_scripts": [
            "subl=sublingual_eval.subl:main",
        ],
    },
    data_files=[
        ("/", ["sublingual_eval.pth"]),
    ],
    license="MIT",
    include_package_data=True,  # Allow non-code files to be included
    package_data={
        "sublingual_dashboard": ["server/**/*"],
    },
    python_requires=">=3.10",
    install_requires=[
        "flask",
        "flask-cors",
        "openai",
        "dotenv",
        "psutil",
        "anthropic",
    ],
)
