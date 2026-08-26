from fastapi import APIRouter, HTTPException, Depends, status
from app.schemas.auth import TokenResponse, LoginRequest, PasswordLoginRequest, SetPasswordRequest, PasswordStatusResponse
from app.repositories.user_repository import UserRepository
from app.core.security import (
    create_app_session_token,
    get_current_firebase_identity,
    get_current_firebase_uid,
    hash_password,
    verify_password,
)
from app.core.logging import logger

router = APIRouter(prefix="/auth", tags=["Authentication Module"])


@router.post("/verify-token", response_model=TokenResponse)
async def verify_id_token(payload: LoginRequest):
    """
    Verifies a Firebase ID Token, generates a signed app session token,
    and returns user profile details if registered.
    """
    token = payload.firebase_id_token.strip() if payload.firebase_id_token else ""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="firebase_id_token is required.",
        )

    try:
        identity = await get_current_firebase_identity(authorization=f"Bearer {token}")
        uid = identity.uid
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired Firebase ID token: {err}",
        ) from err

    user_repo = UserRepository()
    user_record = user_repo.get_by_firebase_uid(uid)
    safe_user = {k: v for k, v in user_record.items() if k != "password_hash"} if user_record else None

    return TokenResponse(
        access_token=create_app_session_token(uid),
        user_id=uid,
        user=safe_user,
    )


@router.post("/login", response_model=TokenResponse)
async def login_with_password(payload: PasswordLoginRequest):
    """
    Password login for registered users. Looks up user by phone/email in database,
    verifies password hash, and returns user profile details.
    """
    if not payload.identifier or not payload.identifier.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number or email is required.",
        )
    if not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required.",
        )

    user_repo = UserRepository()
    user_record = user_repo.get_by_identifier(payload.identifier)

    if not user_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this phone number or email. Please sign in with Phone OTP first to create an account.",
        )

    stored_hash = user_record.get("password_hash")
    if not stored_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No password set for this account yet. Please sign in with Phone OTP first and create an app password in Settings.",
        )

    if not verify_password(payload.password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please try again.",
        )

    logger.info(f"Password login successful for user {user_record.get('firebase_uid', '')[:8]}...")
    # Never expose password_hash to the client
    safe_user = {k: v for k, v in user_record.items() if k != "password_hash"}
    return TokenResponse(
        access_token=create_app_session_token(user_record.get("firebase_uid")),
        user_id=user_record.get("firebase_uid"),
        user=safe_user,
    )


@router.post("/set-password", response_model=TokenResponse)
async def set_app_password(
    payload: SetPasswordRequest,
    current_uid: str = Depends(get_current_firebase_uid),
):
    """
    Allows an authenticated user to set or update their app password in the database.
    """
    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters.",
        )

    if payload.firebase_uid and payload.firebase_uid != current_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot set a password for another user.",
        )

    hashed = hash_password(payload.new_password)
    user_repo = UserRepository()
    try:
        user_repo.set_password(current_uid, hashed)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(err)) from err
    except Exception as err:
        logger.error(f"Failed to set password for uid={current_uid[:8]}...: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(err),
        ) from err

    return TokenResponse(
        access_token="password_updated_ok",
        user_id=current_uid,
    )


@router.get("/password-status", response_model=PasswordStatusResponse)
async def get_password_status(current_uid: str = Depends(get_current_firebase_uid)):
    """Returns whether the authenticated user has set an app password in the database."""
    user_repo = UserRepository()
    return PasswordStatusResponse(has_password=user_repo.has_password(current_uid))
