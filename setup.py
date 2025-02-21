from setuptools import setup, find_packages

setup(
    name="subl",
    version="0.1.0",
    packages=['sublingual_eval', 'dashboard'],  # Explicitly list the packages
    entry_points={
        'console_scripts': [
            'subl=sublingual_eval.subl:main',
            'subl-server=dashboard.run_servers:main',
        ],
    },
)
