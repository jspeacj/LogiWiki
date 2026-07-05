/**
 * 공유 프로필 참조 타입.
 *
 * profiles 테이블(닉네임·아바타)은 인증·서적 저자·댓글·게시판에서 공통으로 참조한다.
 * 임베드 조회(`author:profiles(...)`) 결과 정규화에도 이 형태를 쓴다.
 */
export interface ProfileRef {
  id: string;
  nickname: string;
  avatar_url: string | null;
}
