from setuptools import setup, find_packages

setup(
    name="subl",
    version="0.1.0",
    packages=find_packages(include=['sublingual_eval', 'sublingual_eval.*']),
    entry_points={
        'console_scripts': [
            'subl=sublingual_eval.subl:main',
        ],
    },
)
