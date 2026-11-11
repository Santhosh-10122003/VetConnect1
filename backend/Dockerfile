# Build stage: compiles the jar, so a host can build straight from the repository
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package

# Run stage: a small image with just the jar
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache su-exec \
    && addgroup -S jenni && adduser -S jenni -G jenni \
    && mkdir -p /data/uploads /app/logs && chown -R jenni:jenni /data /app
COPY --from=build /build/target/jenni-backend-1.0.0.jar app.jar
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENV SPRING_PROFILES_ACTIVE=prod \
    UPLOADS_DIR=/data/uploads \
    SEED_DEMO_DATA=false
EXPOSE 8080
# starts as root only to fix the disk's ownership, then the app itself runs as "jenni"
ENTRYPOINT ["/app/docker-entrypoint.sh"]
