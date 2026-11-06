# Mock-mode demo of the GPU Mining Control Hub (no GPU, no miner, nothing is mined).
# Real mining belongs on the Windows host itself: the hub needs the NVIDIA driver,
# the miner binary and Windows process control, none of which a container gives it.
#
#   docker build -t mining-hub .
#   docker run --rm -p 127.0.0.1:8080:8080 mining-hub
#   open http://localhost:8080
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 10001 hub && mkdir /data && chown hub /data
WORKDIR /app
COPY --chown=hub mining_hub ./mining_hub
COPY --chown=hub emergency_stop.py docker/config.json ./
USER hub
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8080/', timeout=2)" || exit 1
CMD ["python", "-m", "mining_hub", "--config", "/app/config.json", "run"]
