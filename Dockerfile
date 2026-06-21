FROM nginx:alpine

COPY index.html /usr/share/nginx/html/
COPY style.css  /usr/share/nginx/html/
COPY script.js  /usr/share/nginx/html/
COPY bg-luxury.png /usr/share/nginx/html/
COPY favicon.ico   /usr/share/nginx/html/
COPY meta.json     /usr/share/nginx/html/

# Configuração nginx com proxy /webhook → backend Orion-Construtora
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
