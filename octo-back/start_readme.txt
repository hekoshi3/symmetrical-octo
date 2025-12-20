Создание БД
docker run --name octo-db -e POSTGRES_DB=aihub_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres

Установка зависимостей
pip install uv
uv sync
или
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

Запуск сервера
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
