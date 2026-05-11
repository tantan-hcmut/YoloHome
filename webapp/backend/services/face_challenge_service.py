import os
import random
import time
import uuid


CHALLENGES = {}
STEP_POOL = ['LEFT', 'RIGHT', 'UP', 'DOWN']
CHALLENGE_TTL_SECONDS = 60


def create_challenge():
    steps = ['CENTER'] + random.sample(STEP_POOL, 2)
    challenge_id = str(uuid.uuid4())
    CHALLENGES[challenge_id] = {
        'steps': steps,
        'expires_at': time.time() + CHALLENGE_TTL_SECONDS
    }
    cleanup_expired()
    return {'challengeId': challenge_id, 'steps': steps}


def consume_challenge(challenge_id):
    cleanup_expired()
    if not challenge_id:
        return None

    challenge = CHALLENGES.pop(challenge_id, None)
    if not challenge or challenge['expires_at'] < time.time():
        return None

    return challenge


def cleanup_expired():
    now = time.time()
    expired = [key for key, value in CHALLENGES.items() if value['expires_at'] < now]
    for key in expired:
        CHALLENGES.pop(key, None)


def validate_head_pose(step, headpose):
    if not headpose:
        return

    yaw = float(headpose.get('yaw_angle') or 0)
    pitch = float(headpose.get('pitch_angle') or 0)
    delta = float(os.getenv('FACE_LIVENESS_MIN_POSE_DELTA', '12'))

    # CENTER is used as the clearest identity frame. We do not reject it by
    # angle because ordinary webcams often report a small offset even when the
    # user is looking straight.
    if step == 'CENTER':
        return

    # Face++ yaw/pitch sign can vary by camera mirroring, so LEFT/RIGHT and
    # UP/DOWN require meaningful movement magnitude while random order prevents
    # replay with one static image.
    if step in ['LEFT', 'RIGHT'] and abs(yaw) < delta:
        raise ValueError(f'Vui lòng quay mặt sang trái/phải rõ hơn. yaw={yaw:.1f}, yêu cầu >= {delta:.1f}.')
    if step in ['UP', 'DOWN'] and abs(pitch) < max(delta - 2, 8):
        required = max(delta - 2, 8)
        raise ValueError(f'Vui lòng ngẩng hoặc cúi mặt rõ hơn. pitch={pitch:.1f}, yêu cầu >= {required:.1f}.')
