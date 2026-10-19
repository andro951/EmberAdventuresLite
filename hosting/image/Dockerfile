# Official release/digest metadata verified 2026-10-19; do not use latest.
FROM lmsysorg/sglang:nightly-dev-cu13-20261019-3c560089@sha256:c1f4d9fc6fcf50c2269adbc757ce7b1778883af04155edb888fa9eea3b6648c0
LABEL org.ember.sglang-revision="3c560089e1818a5217a73f2168273485a5350341"
# Fail the future build if the published image does not contain its advertised Krea pipeline.
# This checks source presence only; a funded GPU smoke is still required.
RUN python3 -c "import pathlib,sglang; assert (pathlib.Path(sglang.__file__).parent / 'multimodal_gen/runtime/pipelines/krea2.py').is_file(), 'Krea pipeline missing from pinned image'"
RUN python3 -m pip install --no-cache-dir runpod==1.12.0
WORKDIR /opt/ember-image
COPY worker.py /opt/ember-image/worker.py
ENV HF_HOME=/cache/huggingface EMBER_IMAGE_MODE=http PORT=30000 PORT_HEALTH=30000
EXPOSE 30000
ENTRYPOINT ["python3", "/opt/ember-image/worker.py"]
