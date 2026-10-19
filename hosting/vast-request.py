"""One request through the official Vast SDK. Secrets arrive only in the process environment."""
import asyncio
import contextlib
import io
import json
import sys


async def main(request):
    from vastai import Serverless
    async with Serverless() as client:
        endpoint = await client.get_endpoint(name=request["endpointName"])
        result = await endpoint.request(request["route"], request["payload"], cost=request["cost"], stream=False)
        return result["response"]


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        # Third-party diagnostics can contain signed routing/auth data. Keep them private.
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            result = asyncio.run(main(request))
        json.dump(result, sys.stdout)
    except Exception:
        sys.exit(1)
