from setuptools import setup, find_packages

setup(
    name="subl",
    version="0.1.0",
    author="Matthew Tang and Dylan Bowman",
    author_email="founders@sublingual.ai",
    description="No-code LLM production app evals.",
    url="https://github.com/sublingual-ai/sublingual-eval",
    packages=["sublingual_eval", "sublingual_dashboard"],  # Explicitly list the packages
    entry_points={
        "console_scripts": [
            "subl=sublingual_eval.subl:main",
            # 'subl-server=dashboard.run_servers:main',
        ],
    },
    license="MIT",
    include_package_data=True,
    exclude_package_data={
        "dashboard": ["frontend/*"],
    },
)
